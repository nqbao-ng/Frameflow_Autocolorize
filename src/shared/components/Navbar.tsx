import { Link } from "react-router";
import { BrandLogo } from "./BrandLogo";

export function Navbar() {
  const navItems = [
    { name: "Features", href: "#features" },
    { name: "Workflow", href: "#workflow" },
    { name: "Human Review", href: "#review" },
  ];

  return (
    <header className="landing-navbar">
      <div className="landing-navbar-inner">
        <BrandLogo height={43} />

        <nav className="landing-nav-links" aria-label="Main navigation">
          {navItems.map((item) => (
            <a key={item.name} href={item.href} className="landing-nav-link">
              {item.name}
            </a>
          ))}
        </nav>

        <div className="landing-navbar-actions">
          <Link to="/signin" className="landing-button landing-button-ghost landing-button-small">
            Sign In
          </Link>
          <Link to="/signup" className="landing-button landing-button-primary landing-button-small">
            Start Free
          </Link>
        </div>
      </div>
    </header>
  );
}
