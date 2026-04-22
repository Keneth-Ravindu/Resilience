import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";

const API_BASE_URL = "http://127.0.0.1:8000";

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

export default function Settings() {
  const [profile, setProfile] = useState(null);

  const [displayName, setDisplayName] = useState("");
  const [statusText, setStatusText] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/users/me");

      setProfile(res.data);
      setDisplayName(res.data.display_name || "");
      setStatusText(res.data.status_text || "");
      setAgeRange(res.data.age_range || "");
      setFitnessLevel(res.data.fitness_level || "");
    } catch {
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const currentProfileImage = useMemo(() => {
    if (preview) return preview;
    if (profile?.profile_picture_url) return resolveMediaUrl(profile.profile_picture_url);
    return null;
  }, [preview, profile]);

  async function saveProfile() {
    try {
      setSavingProfile(true);
      setSuccess("");
      setError("");

      await api.put("/users/me", {
        display_name: displayName,
        status_text: statusText,
        age_range: ageRange,
        fitness_level: fitnessLevel,
      });

      await loadProfile();
      setSuccess("Profile updated successfully.");
    } catch {
      setError("Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadProfilePicture() {
    if (!file) return;

    try {
      setUploadingPhoto(true);
      setSuccess("");
      setError("");

      const form = new FormData();
      form.append("file", file);

      await api.post("/users/me/upload-profile-picture", form, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setFile(null);
      setPreview(null);
      await loadProfile();
      setSuccess("Profile picture updated successfully.");
    } catch {
      setError("Failed to upload profile picture.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);

    if (selected) {
      setPreview(URL.createObjectURL(selected));
    } else {
      setPreview(null);
    }
  }

  if (loading) {
    return (
      <div className="fade-in">
        <section className="glass-card">
          <p>Loading settings...</p>
        </section>
      </div>
    );
  }

  const shownName = displayName || profile?.name || "User";

  return (
    <div className="fade-in settings-page">
      <div className="page-head-with-actions">
        <div>
          <h2 className="page-title">Account Settings</h2>
          <p className="page-subtitle">
            Manage your profile identity, photo, and fitness details.
          </p>
        </div>
      </div>

      <section className="glass-card settings-hero-card modern-settings-hero">
        <div className="settings-hero-content">
          <div className="settings-avatar-block">
            {currentProfileImage ? (
              <img
                src={currentProfileImage}
                alt={shownName}
                className="settings-profile-avatar"
              />
            ) : (
              <div className="settings-profile-avatar settings-profile-avatar-fallback">
                {shownName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="settings-hero-meta">
            <h3 className="settings-profile-name">{shownName}</h3>
            <p className="settings-profile-status">
              {statusText || "No status added yet."}
            </p>

            <div className="public-profile-badges">
              {ageRange ? <span className="tag-pill">{ageRange}</span> : null}
              {fitnessLevel ? <span className="tag-pill">{fitnessLevel}</span> : null}
            </div>
          </div>
        </div>
      </section>

      <div className="settings-grid">
        <section className="glass-card settings-card modern-settings-card">
          <div className="section-head">
            <h3>Profile Picture</h3>
            <p className="feed-subtitle">
              Upload a clean profile photo for your public identity.
            </p>
          </div>

          <div className="settings-upload-panel">
            <div className="settings-upload-preview">
              {currentProfileImage ? (
                <img
                  src={currentProfileImage}
                  alt="Preview"
                  className="settings-preview-image"
                />
              ) : (
                <div className="settings-preview-image settings-profile-avatar-fallback">
                  {shownName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="settings-upload-controls">
            <label className="file-upload">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="file-upload-input"
              />

              <span className="file-upload-btn">Choose File</span>

              <span className="file-upload-name">
                {file ? file.name : "No file selected"}
              </span>
            </label>

              <div className="settings-action-row">
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={uploadProfilePicture}
                  disabled={!file || uploadingPhoto}
                >
                  {uploadingPhoto ? "Uploading..." : "Upload Picture"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card settings-card">
          <div className="section-head">
            <h3>Profile Information</h3>
            <p className="feed-subtitle">
              Update the details other people will see on your profile.
            </p>
          </div>

          <div className="settings-form-grid">
            <div className="field">
              <label>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name"
              />
            </div>

            <div className="field">
              <label>Age Range</label>
              <input
                type="text"
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
                placeholder="e.g. 20-25"
              />
            </div>

            <div className="field">
              <label>Fitness Level</label>
              <input
                type="text"
                value={fitnessLevel}
                onChange={(e) => setFitnessLevel(e.target.value)}
                placeholder="e.g. beginner, intermediate"
              />
            </div>

            <div className="field settings-bio-field">
              <label>Status / Bio</label>
              <textarea
                rows="5"
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="Share a short status, mindset, or goal..."
              />
            </div>
          </div>

          <div className="settings-action-row">
            <button
              className="btn btn-primary"
              type="button"
              onClick={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? "Saving..." : "Save Changes"}
            </button>
          </div>

          {success ? <p className="success-text">{success}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}