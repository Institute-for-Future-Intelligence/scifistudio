import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Avatar, Dropdown, Spin } from 'antd'
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
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../stores'

const { Header, Sider, Content } = Layout

function AppLayout() {
  const { sidebarCollapsed: collapsed, toggleSidebar } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading, signIn, signInAnonymous, signOut } = useAuth()

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Home',
    },
    {
      key: '/story',
      icon: <BookOutlined />,
      label: 'Story Editor',
    },
    {
      key: '/video',
      icon: <VideoCameraOutlined />,
      label: 'Video Editor',
    },
  ]

  const userMenuItems = [
    {
      key: 'profile',
      label: user?.displayName || user?.email || (user?.isAnonymous ? 'Anonymous User' : 'User'),
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'signout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: signOut,
    },
  ]

  const signInMenuItems = [
    {
      key: 'google',
      icon: <GoogleOutlined />,
      label: 'Sign in with Google',
      onClick: signIn,
    },
    {
      key: 'anonymous',
      icon: <UserOutlined />,
      label: 'Continue as Guest',
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
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <h1 style={{ margin: 0, fontSize: collapsed ? 16 : 20, fontWeight: 600 }}>
            {collapsed ? 'SF' : 'Sci-Fi Studio'}
          </h1>
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
          <div>
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
                  Sign In
                </Button>
              </Dropdown>
            )}
          </div>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout
