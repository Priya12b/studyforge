import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Planner from "./pages/Planner";
import Quiz from "./pages/Quiz";
import Flashcards from "./pages/Flashcards";
import RevisionSchedule from "./pages/RevisionSchedule";
import Analytics from "./pages/Analytics";
import Attendance from "./pages/Attendance";
import Profile from "./pages/Profile";
import NotesUpload from "./pages/NotesUpload";
import Gamification from "./pages/Gamification";
import Chatbot from "./pages/Chatbot";
import OAuthCallback from "./pages/OAuthCallback";
import StudyRooms from "./pages/StudyRooms";
import LiveRoom from "./pages/LiveRoom";
import Coach from "./pages/Coach";
import StudyBuddy from "./pages/StudyBuddy";

import { AuthContext } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Admin from "./pages/Admin";
import { useContext } from "react";

function App() {
  const { isAuthenticated } = useContext(AuthContext);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={isAuthenticated ? "/dashboard" : "/login"}
              replace
            />
          }
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/auth/callback"
          element={<OAuthCallback />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          }
        />

        <Route
          path="/planner"
          element={
            <ProtectedRoute>
              <Planner />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <Quiz />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flashcards"
          element={
            <ProtectedRoute>
              <Flashcards />
            </ProtectedRoute>
          }
        />

        <Route
          path="/revision"
          element={
            <ProtectedRoute>
              <RevisionSchedule />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <Attendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notes"
          element={
            <ProtectedRoute>
              <NotesUpload />
            </ProtectedRoute>
          }
        />

        <Route
          path="/gamification"
          element={
            <ProtectedRoute>
              <Gamification />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chatbot"
          element={
            <ProtectedRoute>
              <Chatbot />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rooms"
          element={
            <ProtectedRoute>
              <StudyRooms />
            </ProtectedRoute>
          }
        />

        <Route
          path="/rooms/:roomId"
          element={
            <ProtectedRoute>
              <LiveRoom />
            </ProtectedRoute>
          }
        />

        <Route
          path="/coach"
          element={
            <ProtectedRoute>
              <Coach />
            </ProtectedRoute>
          }
        />

        <Route
          path="/study-buddy"
          element={
            <ProtectedRoute>
              <StudyBuddy />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />



        <Route
          path="*"
          element={
            <Navigate
              to={isAuthenticated ? "/dashboard" : "/login"}
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;