import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ConfigProvider, theme } from 'antd';
import App from './App';
import { persistor, store } from './store';

import 'antd/dist/reset.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConfigProvider
          theme={{
            algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
            token: {
              colorBgBase: '#171717',
              colorTextBase: '#e5e5e5',
              colorPrimary: '#3b82f6',
              colorInfo: '#3b82f6',
              colorBorder: '#404040',
              colorBorderSecondary: '#404040',
              colorBgContainer: '#262626',
              colorLink: '#3b82f6',
              borderRadius: 10,
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            },
            components: {
              Layout: {
                bodyBg: '#171717',
                headerBg: '#171717',
                siderBg: '#171717',
              },
              Card: {
                colorBgContainer: '#262626',
                colorBorderSecondary: '#404040',
                paddingLG: 20,
              },
              Modal: {
                colorBgElevated: '#262626',
                headerBg: '#262626',
                footerBg: '#262626',
                borderRadiusLG: 16,
              },
              Drawer: {
                colorBgElevated: '#262626',
              },
              Tabs: {
                cardBg: '#262626',
                itemColor: '#e5e5e5',
                itemSelectedColor: '#bfdbfe',
                inkBarColor: '#3b82f6',
              },
              Input: {
                colorBgContainer: '#262626',
                colorBorder: '#404040',
                colorText: '#e5e5e5',
                colorTextPlaceholder: '#a3a3a3',
              },
              Select: {
                colorBgContainer: '#262626',
                colorBorder: '#404040',
                colorText: '#e5e5e5',
              },
              Upload: {
                colorBorder: '#404040',
                colorBgContainer: '#262626',
              },
              Table: {
                colorBgContainer: '#262626',
                colorFillAlter: '#1e1e1e',
                colorBorderSecondary: '#404040',
                colorText: '#e5e5e5',
              },
              Tag: {
                defaultColor: '#bfdbfe',
                defaultBg: '#1e3a8a',
              },
              Button: {
                colorBgTextHover: '#1e3a8a',
                colorBorder: '#404040',
                controlHeight: 36,
              },
              Alert: {
                colorBgContainer: '#262626',
                colorBorder: '#404040',
              },
            },
          }}
        >
          <App />
        </ConfigProvider>
      </PersistGate>
    </Provider>
  </React.StrictMode>,
);
