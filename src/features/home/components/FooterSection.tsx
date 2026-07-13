import { Link } from "react-router";
import { BrandLogo } from "../../../shared/components/BrandLogo";
import { FOOTER_NAV_LINKS } from "../constants/homeData";

export function FooterSection() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <BrandLogo height={34} />

        <nav className="landing-footer-links" aria-label="Footer navigation">
          {FOOTER_NAV_LINKS.map((item) => (
            <a key={item.label} href={item.href}>{item.label}</a>
          ))}
          <Link to="/projects">Projects</Link>
        </nav>

        <p>© 2026 FrameFlow. Keyframe-guided color propagation.</p>
      </div>
    </footer>
  );
}
