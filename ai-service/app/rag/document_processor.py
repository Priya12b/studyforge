"""
Document Processor
Handles PDF loading, OCR for images, text extraction, and intelligent chunking.
Pipeline: File → Load → Extract Text → Clean → Chunk → Metadata
"""

import os
from typing import List, Optional
from dataclasses import dataclass

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from app.config import settings
from app.utils.logging import get_logger

logger = get_logger("document_processor")


@dataclass
class ProcessedDocument:
    """Result of document processing."""
    document_id: str
    title: str
    chunks: List[Document]
    total_pages: int
    total_chunks: int
    extracted_text: str
    file_type: str


class DocumentProcessor:
    """
    Processes uploaded documents into chunks suitable for RAG.

    Supports:
    - PDF files via PyPDFLoader
    - Text files (direct reading)
    - Image files via Tesseract OCR (when available)
    """

    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
            is_separator_regex=False,
        )

    async def process_file(
        self,
        file_path: str,
        document_id: str,
        title: Optional[str] = None,
        subject: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> ProcessedDocument:
        """
        Process a file into chunks with metadata.

        Args:
            file_path: Absolute path to the file
            document_id: Unique identifier for this document
            title: Human-readable document title
            subject: Associated academic subject
            user_id: Owner's user ID

        Returns:
            ProcessedDocument with chunks ready for embedding
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        file_type = self._detect_file_type(file_path)
        title = title or os.path.basename(file_path)

        logger.info(
            "processing_document",
            document_id=document_id,
            file_type=file_type,
            path=file_path,
        )

        # Extract raw documents based on file type
        if file_type == "pdf":
            raw_docs = await self._load_pdf(file_path)
        elif file_type == "text":
            raw_docs = await self._load_text(file_path)
        elif file_type == "image":
            raw_docs = await self._load_image_ocr(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

        # Extract full text for summary storage
        full_text = "\n\n".join(doc.page_content for doc in raw_docs)

        # Split into chunks
        chunks = self.text_splitter.split_documents(raw_docs)

        # Enrich chunks with metadata
        for i, chunk in enumerate(chunks):
            chunk.metadata.update({
                "document_id": document_id,
                "chunk_index": i,
                "title": title,
                "subject": subject or "",
                "user_id": user_id or "",
                "file_type": file_type,
            })

        logger.info(
            "document_processed",
            document_id=document_id,
            total_pages=len(raw_docs),
            total_chunks=len(chunks),
        )

        return ProcessedDocument(
            document_id=document_id,
            title=title,
            chunks=chunks,
            total_pages=len(raw_docs),
            total_chunks=len(chunks),
            extracted_text=full_text[:5000],  # Store first 5000 chars
            file_type=file_type,
        )

    async def _load_pdf(self, file_path: str) -> List[Document]:
        """Load and parse a PDF file."""
        loader = PyPDFLoader(file_path)
        return loader.load()

    async def _load_text(self, file_path: str) -> List[Document]:
        """Load a plain text file."""
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return [Document(page_content=content, metadata={"source": file_path})]

    async def _load_image_ocr(self, file_path: str) -> List[Document]:
        """Extract text from an image using Tesseract OCR."""
        try:
            import pytesseract
            from PIL import Image

            image = Image.open(file_path)
            text = pytesseract.image_to_string(image)

            if not text.strip():
                logger.warning("ocr_no_text", file_path=file_path)
                return [Document(
                    page_content="[No text could be extracted from this image]",
                    metadata={"source": file_path},
                )]

            return [Document(page_content=text, metadata={"source": file_path})]

        except ImportError:
            logger.error("tesseract_not_installed")
            raise RuntimeError("Tesseract OCR is not installed. Install it via: apt-get install tesseract-ocr")

    def _detect_file_type(self, file_path: str) -> str:
        """Detect file type from extension."""
        ext = os.path.splitext(file_path)[1].lower()
        type_map = {
            ".pdf": "pdf",
            ".txt": "text",
            ".md": "text",
            ".png": "image",
            ".jpg": "image",
            ".jpeg": "image",
            ".tiff": "image",
            ".bmp": "image",
        }
        return type_map.get(ext, "text")


# Singleton processor
document_processor = DocumentProcessor()
