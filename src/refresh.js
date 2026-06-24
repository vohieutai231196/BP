import React from "react";

// Tín hiệu làm tươi dữ liệu toàn cục. `version` đổi → page/khu vực đang mount fetch lại.
// `refresh()` gọi sau mỗi thao tác CRUD hoặc khi bấm nút Refresh trên TopBar.
export const RefreshContext = React.createContext({ version: 0, refresh: () => {} });
export const useRefresh = () => React.useContext(RefreshContext);
