import { useEffect, useState } from "react";
import api from "../../api/client";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/posts");
        setPosts(res.data || []);
      } catch {
        setError("Failed to load posts.");
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  if (loading) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Feed</h2>
        <section className="glass-card">
          <p>Loading posts...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Feed</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <h2 className="page-title">Feed</h2>

      {posts.length === 0 ? (
        <section className="glass-card">
          <p>No posts yet.</p>
        </section>
      ) : (
        <div className="feed-list">
          {posts.map((post) => (
            <section className="glass-card feed-card" key={post.id}>
              <div className="feed-card-head">
                <h3>Post #{post.id}</h3>
              </div>
              <p className="feed-body">{post.content || post.text || "No content"}</p>
              <div className="feed-meta">
                <span>Created: {post.created_at ? new Date(post.created_at).toLocaleString() : "N/A"}</span>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}