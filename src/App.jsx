import { BrowserRouter, NavLink, Routes, Route, Navigate } from "react-router-dom";
import {LayoutDashboard, Users, MessageSquare, CalendarDays, BarChart3, Settings,
        Search, Bell, Plus, TrendingUp, Heart, Eye, Send, Menu, X, RefreshCw, MessageCircle } from "lucide-react";
import "./App.css";
import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import {login, register, logout, getCurrentUser} from "./services/api";

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Accounts", icon: Users },
  { name: "Feed", icon: MessageSquare },
  { name: "Schedule", icon: CalendarDays },
  { name: "Analytics", icon: BarChart3 }
];

const accounts = [
  { name: "Instagram", username: "@nate.j", color: "#e879a8", followers: "2,450", posts: 84 },
  { name: "Facebook", username: "Nathanial Jarrett", color: "#6598e8", followers: "1,820", posts: 52 },
  { name: "Twitter / X", username: "@natejarrett", color: "#777777", followers: "960", posts: 126 }
];

const feedItems = [
  {
    platform: "Instagram",
    username: "@nate.j",
    time: "2 hours ago",
    text: "Finally finished my project for this week. Time to relax a little!",
    likes: 48,
    comments: 12
  },
  {
    platform: "Facebook",
    username: "Nathanial Jarrett",
    time: "Yesterday",
    text: "Had a great time hanging out with friends this weekend.",
    likes: 32,
    comments: 8
  },
  {
    platform: "Twitter / X",
    username: "@natejarrett",
    time: "Yesterday",
    text: "Working on some new ideas for my social media dashboard project.",
    likes: 19,
    comments: 4
  }
];

function Sidebar({ activePage, setActivePage, open, setOpen, onLogout }) {
  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand">
        <div className="brand-icon">S</div>
        <div>
          <h2>SocialHub</h2>
          <span>Social Media Dashboard</span>
        </div>
        <button className="close-menu" onClick={() => setOpen(false)}>
          <X size={20} />
        </button>
      </div>

      <p className="nav-label">MENU</p>

      <nav>
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              className={`nav-item ${activePage === item.name ? "active" : ""}`}
              onClick={() => {
                setActivePage(item.name);
                setOpen(false);
              }}
            >
              <Icon size={19} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="profile">
          <button className="logout-button" onClick={onLogout}>
              Sign Out
          </button>
          <div className="avatar">NJ</div>
          <div>
            <strong>Nathanial Jarrett</strong>
            <span>Student Account</span>
          </div>
        </div>
      </div>
    </aside>
  );
  
}

function Overview({ setActivePage }) {
  return (
    <>
      <div className="welcome">
        <div>
          <h2>Welcome back, Nathanial!</h2>
          <p>Here is what is happening with your social accounts.</p>
        </div>
        <button className="primary-button" onClick={() => setActivePage("Accounts")}>
          <Plus size={17} /> Add Account
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Followers</span>
          <h2>5,230</h2>
          <p className="positive"><TrendingUp size={15} /> 8.4% this month</p>
        </div>

        <div className="stat-card">
          <span>Total Posts</span>
          <h2>262</h2>
          <p className="positive"><TrendingUp size={15} /> 12 new this week</p>
        </div>

        <div className="stat-card">
          <span>Total Engagement</span>
          <h2>7.8%</h2>
          <p className="positive"><TrendingUp size={15} /> 2.1% this month</p>
        </div>

        <div className="stat-card">
          <span>Connected Accounts</span>
          <h2>3</h2>
          <p className="stat-note">Across 3 platforms</p>
        </div>
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Account Overview</h3>
              <p>Your connected social media accounts</p>
            </div>
            <button className="text-button" onClick={() => setActivePage("Accounts")}>
              View All
            </button>
          </div>

          {accounts.map((account) => (
            <div className="account-row" key={account.name}>
              <div className="platform-icon" style={{ background: account.color }}>
                {account.name.charAt(0)}
              </div>
              <div className="account-info">
                <strong>{account.name}</strong>
                <span>{account.username}</span>
              </div>
              <div className="account-followers">
                <strong>{account.followers}</strong>
                <span>Followers</span>
              </div>
              <span className="connected">Connected</span>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent Activity</h3>
              <p>Your latest social updates</p>
            </div>
            <button className="text-button" onClick={() => setActivePage("Feed")}>
              View Feed
            </button>
          </div>

          {feedItems.slice(0, 2).map((item, index) => (
            <div className="activity-row" key={index}>
              <div className="activity-dot"></div>
              <div>
                <strong>{item.platform}</strong>
                <p>{item.text}</p>
                <span>{item.time}</span>
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h3>Weekly Engagement</h3>
            <p>Example engagement data for this week</p>
          </div>
          <span className="chart-label">Last 7 days</span>
        </div>

        <div className="bar-chart">
          {[45, 65, 50, 82, 60, 95, 72].map((height, index) => (
            <div className="bar-column" key={index}>
              <div className="bar" style={{ height: `${height}%` }}></div>
              <span>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Accounts() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Connected Accounts</h3>
          <p>Manage your social media accounts in one place.</p>
        </div>
        <button className="primary-button">
          <Plus size={17} /> Add Account
        </button>
      </div>

      <div className="account-cards">
        {accounts.map((account) => (
          <div className="account-card" key={account.name}>
            <div className="platform-icon large" style={{ background: account.color }}>
              {account.name.charAt(0)}
            </div>
            <h3>{account.name}</h3>
            <p>{account.username}</p>
            <div className="account-card-stats">
              <div>
                <strong>{account.followers}</strong>
                <span>Followers</span>
              </div>
              <div>
                <strong>{account.posts}</strong>
                <span>Posts</span>
              </div>
            </div>
            <span className="connected">Connected</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Feed() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Activity Feed</h3>
          <p>Recent posts from your connected accounts.</p>
        </div>
        <button className="secondary-button">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {feedItems.map((item, index) => (
        <div className="feed-card" key={index}>
          <div className="feed-top">
            <div className="avatar">{item.platform.charAt(0)}</div>
            <div>
              <strong>{item.username}</strong>
              <span>{item.platform} · {item.time}</span>
            </div>
          </div>
          <p className="feed-text">{item.text}</p>
          <div className="feed-actions">
            <span><Heart size={17} /> {item.likes} Likes</span>
            <span><MessageCircle size={17} /> {item.comments} Comments</span>
          </div>
        </div>
      ))}
    </section>
  );
}

function Schedule() {
  const scheduledPosts = [
    { day: "18", month: "NOV", title: "New project update", platform: "Instagram", time: "10:00 AM" },
    { day: "20", month: "NOV", title: "Weekend post", platform: "Facebook", time: "2:30 PM" },
    { day: "22", month: "NOV", title: "Weekly update", platform: "Twitter / X", time: "5:00 PM" }
  ];

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Scheduled Posts</h3>
          <p>Keep track of posts you plan to publish.</p>
        </div>
        <button className="primary-button">
          <Plus size={17} /> New Post
        </button>
      </div>

      {scheduledPosts.map((post) => (
        <div className="schedule-row" key={post.day}>
          <div className="date-box">
            <strong>{post.day}</strong>
            <span>{post.month}</span>
          </div>
          <div className="schedule-info">
            <strong>{post.title}</strong>
            <span>{post.platform}</span>
          </div>
          <div className="schedule-time">
            <span>{post.time}</span>
            <small>Planned</small>
          </div>
        </div>
      ))}
    </section>
  );
}

function Analytics() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Analytics</h3>
          <p>A basic look at your social media performance.</p>
        </div>
        <span className="chart-label">Sample data</span>
      </div>

      <div className="stats-grid analytics-stats">
        <div className="stat-card">
          <span>Reach</span>
          <h2>12.4K</h2>
          <p className="positive">+10.5%</p>
        </div>
        <div className="stat-card">
          <span>Likes</span>
          <h2>1,245</h2>
          <p className="positive">+6.2%</p>
        </div>
        <div className="stat-card">
          <span>Comments</span>
          <h2>386</h2>
          <p className="positive">+4.8%</p>
        </div>
        <div className="stat-card">
          <span>Engagement</span>
          <h2>7.8%</h2>
          <p className="positive">+2.1%</p>
        </div>
      </div>

      <h3 className="simple-heading">Performance by Platform</h3>
      {[
        { name: "Instagram", amount: 85 },
        { name: "Facebook", amount: 62 },
        { name: "Twitter / X", amount: 45 }
      ].map((item) => (
        <div className="performance-row" key={item.name}>
          <div className="performance-label">
            <strong>{item.name}</strong>
            <span>{item.amount}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${item.amount}%` }}></div>
          </div>
        </div>
      ))}
    </section>
  );
}


function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [authPage, setAuthPage] = useState("login");
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setCheckingUser(false));
  }, []);

  async function handleLogin(email, password) {
    const data = await login(email, password);
    setUser(data.user);
  }

  async function handleRegister(name, email, password) {
    const data = await register(name, email, password);
    setUser(data.user);
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      setActivePage("Overview");
      setAuthPage("login");
    }
  }

  function renderPage() {
    switch (activePage) {
      case "Accounts":
        return <Accounts />;
      case "Feed":
        return <Feed />;
      case "Schedule":
        return <Schedule />;
      case "Analytics":
        return <Analytics />;
      default:
        return <Overview setActivePage={setActivePage} />;
    }
  }

  if (checkingUser) {
    return <div className="auth-page">Loading SocialHub...</div>;
  }

  if (!user) {
    return authPage === "login" ? (
      <Login
        onLogin={handleLogin}
        onSwitchToRegister={() => setAuthPage("register")}
      />
    ) : (
      <Register
        onRegister={handleRegister}
        onSwitchToLogin={() => setAuthPage("login")}
      />
    );
  }

  return (
    <div className="app">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        open={menuOpen}
        setOpen={setMenuOpen}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div>
            <h1>{activePage}</h1>
            <p>SocialHub / {activePage}</p>
          </div>

          <div className="topbar-right">
            <label className="search-box">
              <Search size={17} />
              <input placeholder="Search..." />
            </label>

            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
            </button>

            <div className="top-avatar">
              {user.display_name ? user.display_name.substring(0, 2).toUpperCase() : "NJ"}
            </div>
          </div>
        </header>

        <div className="page-content">
          {renderPage()}
          <footer>SocialHub · College Project · Phase 1</footer>
        </div>
      </main>
    </div>
  );
}

export default App;
