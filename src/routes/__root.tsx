import { createRootRoute, Link, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => (
    <div className="app">
      <nav className="navbar">
        <h1>LG ThinQ Local Server</h1>
        <ul className="nav-links">
          <li>
            <Link to="/" activeOptions={{ exact: true }}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/parsers">Protocol Parsers</Link>
          </li>
          <li>
            <Link to="/mqtt">MQTT Monitor</Link>
          </li>
          <li>
            <Link to="/devices">Device Manager</Link>
          </li>
          <li>
            <Link to="/config">Configuration</Link>
          </li>
        </ul>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  ),
});