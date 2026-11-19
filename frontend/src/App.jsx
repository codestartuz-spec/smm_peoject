import { Navigate, Route, Routes } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { get } from './lib/api'
import { Spinner } from './components/ui'
import Layout from './components/Layout'
import BusinessLayout from './components/BusinessLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Overview from './pages/Overview'
import CalendarPage from './pages/CalendarPage'
import Posts from './pages/Posts'
import PostEditor from './pages/PostEditor'
import AiStudio from './pages/AiStudio'
import Stats from './pages/Stats'
import Comments from './pages/Comments'
import Channels from './pages/Channels'
import BusinessSettings from './pages/BusinessSettings'
import AppSettings from './pages/AppSettings'
import MediaLibrary from './pages/MediaLibrary'
import Profile from './pages/Profile'

export default function App() {
  const { data, isLoading, error } = useQuery({ queryKey: ['session'], queryFn: () => get('/api/session/'), staleTime: 60_000 })
  if (isLoading) return <div className="grid h-full place-items-center"><Spinner /></div>
  if (error) return <div className="grid h-full place-items-center p-6 text-center text-red-600">Serverga ulanib bo'lmadi. Django ishlayaptimi? ({error.message})</div>
  if (!data.authenticated) return <Login />
  return (
    <Routes>
      <Route element={<Layout user={data.user} name={data.name} />}>
        <Route index element={<Dashboard />} />
        <Route path="settings" element={<AppSettings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="b/:slug" element={<BusinessLayout />}>
          <Route index element={<Overview />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="posts" element={<Posts />} />
          <Route path="posts/:id" element={<PostEditor />} />
          <Route path="ai" element={<AiStudio />} />
          <Route path="stats" element={<Stats />} />
          <Route path="media" element={<MediaLibrary />} />
          <Route path="comments" element={<Comments />} />
          <Route path="channels" element={<Channels />} />
          <Route path="settings" element={<BusinessSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
