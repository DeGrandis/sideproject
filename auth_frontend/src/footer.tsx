import './footer.css';
import { type FC } from 'react';

import unitedStatesIcon from './united-states.png'; // Adjust the path as needed

export const SharedFooter: FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <span>© 2025 DEGRAND.IS &nbsp;|&nbsp; All rights reserved.</span>
        <br />
        <span className="footer-made">
          Made honorably in The United States of America
          <img src={unitedStatesIcon} alt="USA" className="usaicon" />
        </span>
        <br />
        <span className="footer-links">
          <a href="#" className="footer-link">
            Privacy Policy
          </a>
          &nbsp;|&nbsp;
          <a href="#" className="footer-link">
            Terms of Service
          </a>
        </span>
      </div>
    </footer>
  );
};

export default SharedFooter;