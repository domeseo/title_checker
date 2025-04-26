import React from "react";
import {Navbar, Form, Button, Alert, Spinner } from "react-bootstrap";


const NavBarTool = () => {


return (

<nav className="navbar navbar-expand-lg fixed-top bg-light navbar-light mb-5">
  <div className="container">
    <a className="navbar-brand" href="#"><img id="Seo Tool Logo"
        src="https://www.domenicopuzone.com/wp-content/uploads/2016/01/logo-dp-1.png" alt="Seo Tool"
        draggable="false" height="30" /></a>
    <button className="navbar-toggler" type="button" data-mdb-collapse-init data-mdb-target="#navbarSupportedContent"
      aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
      <i className="fas fa-bars"></i>
    </button>
    <div className="collapse navbar-collapse" id="navbarSupportedContent">
      <ul className="navbar-nav ms-auto align-items-center">
        <li className="nav-item">
          <a className="nav-link mx-2" href="#!"><i className="fas fa-plus-circle pe-2"></i>Price</a>
        </li>
        <li className="nav-item">
          <a className="nav-link mx-2" href="#!"><i className="fas fa-bell pe-2"></i>Info</a>
        </li>
        <li className="nav-item ms-3">
          <a className="btn btn-dark btn-rounded" href="#!">Sign in</a>
        </li>
      </ul>
    </div>
  </div>
</nav>

    )
};

export default NavBarTool;