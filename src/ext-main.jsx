/* ============================================================
   GomĐơn Collector — Chrome Extension demo entry.
   Renders the popup inside a faux Chrome browser window so the
   MV3 popup can be previewed over a platform order page.
   ============================================================ */
import React from "react";
import ReactDOM from "react-dom/client";

import "./styles/theme.css";
import "./styles/ext.css";

import { ChromeWindow } from "./extension/chrome-window.jsx";
import { ExtApp } from "./extension/popup.jsx";

function ExtRoot() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 28, boxSizing: "border-box" }}>
      <ChromeWindow width={1180} height={720} url="trade.taobao.com/trade/itemlist/list_bought_items.htm"
        tabs={[{ title: "Đơn đã mua — Taobao" }, { title: "GomĐơn Dashboard" }]} activeIndex={0}>
        <ExtApp />
      </ChromeWindow>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<ExtRoot />);
