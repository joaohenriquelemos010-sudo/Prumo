import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { ProtectedRoute, ProtectedFullscreen } from './ProtectedRoute'

// Lazy-loaded routes → code splitting per route.
const Home = lazy(() => import('@/pages/Home'))
const Trilha = lazy(() => import('@/pages/Trilha'))
const Gestantes = lazy(() => import('@/pages/Gestantes'))
const Medicos = lazy(() => import('@/pages/Medicos'))
const Seguranca = lazy(() => import('@/pages/Seguranca'))
const Onboarding = lazy(() => import('@/pages/Onboarding'))
const Entrar = lazy(() => import('@/pages/Entrar'))
const EsqueciSenha = lazy(() => import('@/pages/EsqueciSenha'))
const Vincular = lazy(() => import('@/pages/Vincular'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// Internal (authenticated) area.
const AppHome = lazy(() => import('@/pages/app/AppHome'))
const AppTrilha = lazy(() => import('@/pages/app/AppTrilha'))
const AppPerfil = lazy(() => import('@/pages/app/AppPerfil'))
const AppAgenda = lazy(() => import('@/pages/app/AppAgenda'))
const AppBebe = lazy(() => import('@/pages/app/AppBebe'))
const AppVacinas = lazy(() => import('@/pages/app/AppVacinas'))
const AppProntuario = lazy(() => import('@/pages/app/AppProntuario'))
const AppCaderninho = lazy(() => import('@/pages/app/AppCaderninho'))
const AppExames = lazy(() => import('@/pages/app/AppExames'))
const AppConsultas = lazy(() => import('@/pages/app/AppConsultas'))
const AppProfissionais = lazy(() => import('@/pages/app/AppProfissionais'))
const AppCompartilhar = lazy(() => import('@/pages/app/AppCompartilhar'))
const AppComunidade = lazy(() => import('@/pages/app/AppComunidade'))
const AppAdmin = lazy(() => import('@/pages/app/AppAdmin'))
const AppPacientes = lazy(() => import('@/pages/app/AppPacientes'))
const AppPaciente = lazy(() => import('@/pages/app/AppPaciente'))
const AppAtendimento = lazy(() => import('@/pages/app/AppAtendimento'))
const AppLembretes = lazy(() => import('@/pages/app/AppLembretes'))
const AppTeleconsulta = lazy(() => import('@/pages/app/AppTeleconsulta'))
const AppFinanceiro = lazy(() => import('@/pages/app/AppFinanceiro'))
const AppConfigurarAgenda = lazy(() => import('@/pages/app/AppConfigurarAgenda'))

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
        { path: '/vincular/:token', element: <Vincular /> },
        { path: '/painel', element: <Dashboard /> },
        { path: '*', element: <NotFound /> },
      ],
    },
    {
      /**
       * O cockpit de atendimento fica FORA do shell da plataforma: ele ocupa a
       * viewport inteira e não oferece navegação para fora no meio de uma
       * consulta. Por isso é uma árvore própria, e não uma rota do `/app`.
       */
      path: '/app/atendimento',
      element: <ProtectedFullscreen />,
      children: [{ path: ':consultaId', element: <AppAtendimento /> }],
    },
    {
      /**
       * A teleconsulta também é tela cheia, e pelo mesmo motivo do cockpit: no
       * meio de uma consulta ninguém navega para outro lugar, e uma barra de
       * navegação ali só oferece maneiras de estragar a chamada.
       */
      path: '/app/teleconsulta',
      element: <ProtectedFullscreen />,
      children: [{ path: ':agendamentoId', element: <AppTeleconsulta /> }],
    },
    {
      path: '/app',
      element: <ProtectedRoute />,
      children: [
        { index: true, element: <AppHome /> },
        { path: 'trilha', element: <AppTrilha /> },
        // O calendário precisa de sete colunas sem scroll horizontal.
        { path: 'agenda', element: <AppAgenda />, handle: { largura: 'ampla' } },
        /* O passo entre criar a conta e usar o produto. Ver `AppConfigurarAgenda`. */
        { path: 'configurar-agenda', element: <AppConfigurarAgenda /> },
        { path: 'bebe', element: <AppBebe /> },
        { path: 'vacinas', element: <AppVacinas /> },
        { path: 'prontuario', element: <AppProntuario /> },
        { path: 'caderninho', element: <AppCaderninho /> },
        { path: 'exames', element: <AppExames /> },
        { path: 'consultas', element: <AppConsultas /> },
        { path: 'profissionais', element: <AppProfissionais /> },
        { path: 'pacientes', element: <AppPacientes /> },
        /* O hub de uma paciente. Tudo o que é clínico mora aqui dentro, em abas. */
        { path: 'pacientes/:jornadaId', element: <AppPaciente /> },
        { path: 'compartilhar', element: <AppCompartilhar /> },
        { path: 'comunidade', element: <AppComunidade /> },
        { path: 'lembretes', element: <AppLembretes /> },
        { path: 'financeiro', element: <AppFinanceiro /> },
        { path: 'admin', element: <AppAdmin /> },
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
