import React, { useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import Auth from "./Auth";
import MatchList from "./MatchList";
import PredictionForm from "./PredictionForm";
import Leaderboard from "./Leaderboard";
import AdminPanel from "./AdminPanel";
import "./style.css";

function MainApp() {
  const { user, signOut, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("matches");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [existingPrediction, setExistingPrediction] = useState(null);
  const [showPredictionForm, setShowPredictionForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectMatch = (match, prediction) => {
    setSelectedMatch(match);
    setExistingPrediction(prediction);
    setShowPredictionForm(true);
  };

  const handleClosePredictionForm = () => {
    setShowPredictionForm(false);
    setSelectedMatch(null);
    setExistingPrediction(null);
  };

  const handlePredictionSaved = () => {
    setRefreshKey((prev) => prev + 1);
    handleClosePredictionForm();
  };

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>AFCON 2025 Predictions</h1>
          <button className="btn-logout" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === "matches" ? "active" : ""}`}
          onClick={() => setActiveTab("matches")}
        >
          Matches
        </button>
        <button
          className={`nav-btn ${activeTab === "leaderboard" ? "active" : ""}`}
          onClick={() => setActiveTab("leaderboard")}
        >
          Leaderboard
        </button>
        <button
          className={`nav-btn ${activeTab === "admin" ? "active" : ""}`}
          onClick={() => setActiveTab("admin")}
        >
          Admin
        </button>
      </nav>

      <main className="app-main">
        {activeTab === "matches" && (
          <MatchList key={refreshKey} onSelectMatch={handleSelectMatch} />
        )}
        {activeTab === "leaderboard" && <Leaderboard key={refreshKey} />}
        {activeTab === "admin" && <AdminPanel key={refreshKey} />}
      </main>

      {showPredictionForm && selectedMatch && (
        <PredictionForm
          match={selectedMatch}
          existingPrediction={existingPrediction}
          onClose={handleClosePredictionForm}
          onSaved={handlePredictionSaved}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
