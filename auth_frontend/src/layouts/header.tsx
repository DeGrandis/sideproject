import React from "react";
import { useNavigate } from "react-router-dom";
import "../assets/styles/App.css";
import "../assets/styles/degrandis.css";

const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header
      className="site-header"
      style={{
        width: "100%",
        marginBottom: "2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: "2rem",
        letterSpacing: "0.05em",
        boxSizing: "border-box",
        paddingLeft: "2rem",
        paddingRight: "1rem"
      }}
    >
      <span style={{ color: "var(--custom-red, #b00020)", fontWeight: 900, fontSize: "2.2rem" }}></span>
      <span
        style={{
          color: "var(--custom-gray, #222)",
          fontSize: "1.1rem",
          fontWeight: 500,
          cursor: "pointer"
        }}
        tabIndex={0}
        role="button"
        onClick={() => navigate("/auth")}
      >
        Login
      </span>
    </header>
  );
};

export default Header;