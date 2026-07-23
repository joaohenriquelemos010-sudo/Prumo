import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { ProtectedRoute } from './ProtectedRoute'

// Lazy-loaded routes → code splitting per route.
const Home = lazy(() => import('@/pages/Home'))
const Trilha = lazy(() => import('@/pages/Trilha'))
const Gestantes = lazy(() => import('@/pages/Gestantes'))
const Medicos = lazy(() => import('@/pages/Medicos'))
const Seguranca = lazy(() => import('@/pages/Seguranca'))
const Onboarding = lazy(() => import('@/pages/Onboarding'))
const Entrar = lazy(() => import('@/pages/Entrar'))
const EsqueciSenha = lazy(() => import('@/pages/EsqueciSenha'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// Internal (authenticated) area.
const AppHome = lazy(() => import('@/pages/app/AppHome'))
const AppTrilha = lazy(() => import('@/pages/app/AppTrilha'))
const AppPerfil = lazy(() => import('@/pages/app/AppPerfil'))
const AppAgenda = lazy(() => import('@/pages/app/AppAgenda'))
const AppVacinas = lazy(() => import('@/pages/app/AppVacinas'))
const AppProntuario = lazy(() => import('@/pages/app/AppProntuario'))
const AppCaderninho = lazy(() => import('@/pages/app/AppCaderninho'))
const AppExames = lazy(() => import('@/pages/app/AppExames'))
const AppConsultas = lazy(() => import('@/pages/app/AppConsultas'))
const AppProfissionais = lazy(() => import('@/pages/app/AppProfissionais'))

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: '/', element: <Home /> },
        { path: '/trilha', element: <Trilha /> },
        { path: '/gestantes', element: <Gestantes /> },
        { path: '/medicos', element: <Medicos /> },
        { path: '/seguranca', element: <Seguranca /> },
        { path: '/onboarding', element: <Onboarding /> },
        { path: '/entrar', element: <Entrar /> },
        { path: '/esqueci-senha', element: <EsqueciSenha /> },
        { path: '/painel', element: <Dashboard /> },
        { path: '*', element: <NotFound /> },
      ],
    },
    {
      path: '/app',
      element: <ProtectedRoute />,
      children: [
        { index: true, element: <AppHome /> },
        { path: 'trilha', element: <AppTrilha /> },
        { path: 'agenda', element: <AppAgenda /> },
        { path: 'vacinas', element: <AppVacinas /> },
        { path: 'prontuario', element: <AppProntuario /> },
        { path: 'caderninho', element: <AppCaderninho /> },
        { path: 'exames', element: <AppExames /> },
        { path: 'consultas', element: <AppConsultas /> },
        { path: 'profissionais', element: <AppProfissionais /> },
        { path: 'perfil', element: <AppPerfil /> },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
)
