const LoadingSpinner = ({ message = "Loading..." }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 16 }}>
    <div className="spinner" />
    <p className="muted">{message}</p>
  </div>
);

export default LoadingSpinner;
