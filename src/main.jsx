import React from 'react';
import ReactDOM from 'react-dom/client';
import Nexora from './Nexora.jsx';

// Self-hosted fonts: bundled with the app, so there is no render-blocking
// third-party stylesheet. Only the subsets a page actually uses are fetched.
import '@fontsource-variable/manrope/wght.css';
import '@fontsource/dm-mono/latin-400.css';
import '@fontsource/dm-mono/latin-500.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/sections/hero.css';
import './styles/sections/market.css';
import './styles/sections/detail.css';
import './styles/sections/trade.css';
import './styles/sections/portfolio.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Nexora />
  </React.StrictMode>
);
