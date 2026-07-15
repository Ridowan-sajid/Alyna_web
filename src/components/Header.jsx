import { useState, useRef, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "./Header.css";
import { RiHome2Line } from "react-icons/ri";
import { RiDoorOpenLine } from "react-icons/ri";
import { BsImage } from "react-icons/bs";
import { RiInformationLine } from "react-icons/ri";
import { RiContactsBookLine } from "react-icons/ri";

/* ── Icons used only in the mobile drawer ── */
const Icons = {
  Home: <RiHome2Line size={24} />,
  Rooms: <RiDoorOpenLine size={24} />,
  Gallery: <BsImage size={24} />,
  About: <RiInformationLine size={24} />,
  "Contact Us": <RiContactsBookLine size={24} />,
};

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(0);

  const location = useLocation();
  const hoverTimer = useRef(null);

  const defaultNavLinks = [
    { label: "Home", href: "/" },
    { label: "Rooms", mobileLabel: "Room Categories", submenu: [] },
    { label: "Gallery", href: "/gallery" },
    { label: "About", href: "/about" },
    { label: "Contact Us", href: "/contact" },
  ];

  const [navLinks, setNavLinks] = useState(defaultNavLinks);

  // ✅ Detect if any rooms route is active — check first path segment is `rooms`
  const getFirstSegment = (p) => (p || "").split("/").filter(Boolean)[0] || "";
  const isRoomsActive = getFirstSegment(location.pathname) === "rooms";

  // Close on route change
  useEffect(() => {
    setRoomOpen(false);
    setMenuOpen(false);
  }, [location]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  // Load rooms/accommodations from Supabase and populate the Rooms submenu
  useEffect(() => {
    let mounted = true;

    async function loadRooms() {
      try {
        const { data, error } = await supabase
          .from("accommodations")
          .select("id,title,links,slug")
          .order("id", { ascending: true });

        if (error) {
          console.error("Failed to load rooms for navbar:", error);
          return;
        }

        if (!mounted || !data) return;

        const roomsSubmenu = data.map((r) => ({
          label: r.title || `Room ${r.id}`,
          href: `/rooms/${r.slug || r.id}`,
        }));

        setNavLinks((prev) =>
          prev.map((l) =>
            l.label === "Rooms" ? { ...l, submenu: roomsSubmenu } : l,
          ),
        );
      } catch (e) {
        console.error(e);
      }
    }

    loadRooms();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const updateHeaderOffset = () => {
      const height = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--offer-sticky-banner-height"
        ) || "0"
      );
      setHeaderOffset(height || 0);
    };

    updateHeaderOffset();
    window.addEventListener("resize", updateHeaderOffset);
    window.addEventListener("scroll", updateHeaderOffset, { passive: true });

    const observer = new MutationObserver(() => {
      updateHeaderOffset();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
      subtree: false,
    });

    return () => {
      window.removeEventListener("resize", updateHeaderOffset);
      window.removeEventListener("scroll", updateHeaderOffset);
      observer.disconnect();
    };
  }, [location.pathname]);

  const handleRoomsMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setRoomOpen(true);
  };

  const handleRoomsMouseLeave = () => {
    hoverTimer.current = setTimeout(() => setRoomOpen(false), 200);
  };

  const closeAll = () => {
    setMenuOpen(false);
    setRoomOpen(false);
  };

  return (
    <>
      <header className="header" style={{ top: `${headerOffset}px` }}>
        <nav className="navbar">
          <NavLink to="/" className="logo">
            <img src="/Svg/header_logo.svg" alt="Logo" />
            {/* Alyna&apos;s <br /> Resort */}
          </NavLink>

          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>
            <span></span>
            <span></span>
            <span></span>
          </button>

          <ul className={`nav-links ${menuOpen ? "open" : ""}`}>
            <div className="mobile-drawer-header">
              <button className="mobile-close-btn" onClick={closeAll}>
                ✕
              </button>
              <span className="mobile-drawer-title">Menu</span>
            </div>

            {navLinks.map((link) => (
              <li
                key={link.label + location.pathname}
                className="nav-item"
                onMouseEnter={link.submenu ? handleRoomsMouseEnter : undefined}
                onMouseLeave={link.submenu ? handleRoomsMouseLeave : undefined}
              >
                {link.submenu ? (
                  <>
                    <div
                      className={`nav-parent ${isRoomsActive ? "active" : ""}`}
                      onClick={() => setRoomOpen(!roomOpen)}
                    >
                      <span className="nav-icon">{Icons.Rooms}</span>

                      <span className="nav-label-desktop">{link.label}</span>
                      <span className="nav-label-mobile">
                        {link.mobileLabel}
                      </span>

                      <span className="nav-parent-arrow">
                        {roomOpen ? "▲" : "▼"}
                      </span>

                      <span className="desktop-arrow"> ▾</span>
                    </div>

                    <ul
                      className={`dropdown ${isRoomsActive ? "dropdown-room-active" : "dropdown-offset"} ${roomOpen ? "show" : ""}`}
                    >
                      {link.submenu.map((sub) => {
                        const normalize = (p = "") =>
                          `/${(p || "").replace(/^\/+|\/+$/g, "")}`;
                        const loc = normalize(location.pathname);
                        const subPath = normalize(sub.href);

                        const locParts = loc.split("/").filter(Boolean);
                        const subParts = subPath.split("/").filter(Boolean);

                        const isSubActive =
                          loc === subPath ||
                          (locParts[0] === "rooms" &&
                            subParts[0] === "rooms" &&
                            (locParts[1] || "") === (subParts[1] || ""));

                        return (
                          <li key={sub.href}>
                            <NavLink
                              to={sub.href}
                              className={() => (isSubActive ? "active" : "")}
                              onClick={closeAll}
                            >
                              {sub.label}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <NavLink
                    to={link.href}
                    className={({ isActive }) => (isActive ? "active" : "")}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="nav-icon">{Icons[link.label]}</span>
                    {link.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div
        className={`mobile-overlay ${menuOpen ? "open" : ""}`}
        onClick={closeAll}
      />
    </>
  );
}
