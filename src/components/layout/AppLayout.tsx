/*
 * Copyright 2026 Institute for Future Intelligence, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Avatar, Dropdown, Spin, Space } from 'antd'
import {
  HomeOutlined,
  BookOutlined,
  VideoCameraOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  GoogleOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../stores'
import Logo from '../common/Logo'
import CookieConsent from '../common/CookieConsent'
import LanguageSelector from '../common/LanguageSelector'

const { Header, Sider, Content, Footer } = Layout

function AppLayout() {
  const { sidebarCollapsed: collapsed, toggleSidebar } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading, signIn, signInAnonymous, signOut } = useAuth()
  const { t } = useTranslation()

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: t('nav.home'),
    },
    {
      key: '/story',
      icon: <BookOutlined />,
      label: t('nav.storyEditor'),
    },
    {
      key: '/video',
      icon: <VideoCameraOutlined />,
      label: t('nav.videoEditor'),
    },
  ]

  const userMenuItems = [
    {
      key: 'profile',
      label: user?.displayName || user?.email || (user?.isAnonymous ? t('auth.guest') : 'User'),
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'signout',
      icon: <LogoutOutlined />,
      label: t('auth.signOut'),
      onClick: signOut,
    },
  ]

  const signInMenuItems = [
    {
      key: 'google',
      icon: <GoogleOutlined />,
      label: t('auth.signInWithGoogle'),
      onClick: signIn,
    },
    {
      key: 'anonymous',
      icon: <UserOutlined />,
      label: t('auth.continueAsGuest'),
      onClick: signInAnonymous,
    },
  ]

  const getSelectedKey = () => {
    if (location.pathname === '/') return '/'
    if (location.pathname.startsWith('/story')) return '/story'
    if (location.pathname.startsWith('/video')) return '/video'
    return '/'
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light">
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Logo size={collapsed ? 28 : 32} />
          {!collapsed && (
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#4f46e5' }}>
              {t('app.title')}
            </h1>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
          />
          <Space>
            <LanguageSelector />
            {user ? (
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Avatar
                  src={user.photoURL}
                  icon={!user.photoURL && <UserOutlined />}
                  style={{ cursor: 'pointer' }}
                />
              </Dropdown>
            ) : (
              <Dropdown menu={{ items: signInMenuItems }} placement="bottomRight">
                <Button type="primary">
                  {t('auth.signIn')}
                </Button>
              </Dropdown>
            )}
          </Space>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
        <Footer style={{ textAlign: 'center', color: '#999', background: 'transparent' }}>
          &copy; {new Date().getFullYear()} {t('app.copyright')} Version {__APP_VERSION__}
        </Footer>
      </Layout>
      <CookieConsent />
    </Layout>
  )
}

export default AppLayout
