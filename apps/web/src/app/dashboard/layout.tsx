'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { LogOut, User, LayoutDashboard, Calendar, Users, FileText, Settings, DollarSign, Menu, X, UserCog, ChevronDown, ChevronRight, FolderOpen, Package, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [hasRedirected, setHasRedirected] = React.useState(false);
  const [expandedMenuGroups, setExpandedMenuGroups] = React.useState<Set<string>>(new Set(['cadastros'])); // CADASTROS expandido por padrão

  // Redirecionar para login se não estiver autenticado
  React.useEffect(() => {
    if (!loading && !user && !hasRedirected) {
      setHasRedirected(true);
      router.push('/login');
    }
  }, [user, loading, hasRedirected, router]);

  // Mostrar loading enquanto verifica autenticação ou se redirecionou
  if (loading || (hasRedirected && !user)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  type MenuItem = {
    type: 'item';
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
  };

  type MenuGroup = {
    type: 'group';
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    key: string;
    items: MenuItem[];
  };

  const menuStructure: (MenuItem | MenuGroup)[] = [
    { type: 'item', icon: LayoutDashboard, label: 'Início', href: '/dashboard' },
    { type: 'item', icon: Calendar, label: 'Agenda', href: '/dashboard/agenda' },
    {
      type: 'group',
      icon: FolderOpen,
      label: 'CADASTROS',
      key: 'cadastros',
      items: [
        { type: 'item', icon: Users, label: 'Pacientes', href: '/dashboard/pacientes' },
        { type: 'item', icon: UserCog, label: 'Equipe', href: '/dashboard/equipe' },
        { type: 'item', icon: ClipboardList, label: 'Procedimentos', href: '/dashboard/cadastros/procedimentos' },
        { type: 'item', icon: Package, label: 'Fornecedores', href: '/dashboard/cadastros/fornecedores' },
      ],
    },
    { type: 'item', icon: FileText, label: 'Prontuários (PEP)', href: '/dashboard/pep' },
    { type: 'item', icon: DollarSign, label: 'Financeiro', href: '/dashboard/financeiro' },
    { type: 'item', icon: Settings, label: 'Configurações', href: '/dashboard/configuracoes' },
  ];

  const toggleMenuGroup = (key: string) => {
    setExpandedMenuGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const isMenuItemActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isMenuGroupActive = (group: MenuGroup) => {
    return group.items.some((item) => isMenuItemActive(item.href));
  };

  const renderMenuItem = (item: MenuItem) => {
    const isActive = isMenuItemActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-600'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <item.icon className="h-5 w-5 mr-3" />
        {item.label}
      </Link>
    );
  };

  const renderMenuGroup = (group: MenuGroup) => {
    const isExpanded = expandedMenuGroups.has(group.key);
    const isActive = isMenuGroupActive(group);
    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

    return (
      <div key={group.key}>
        <button
          onClick={() => toggleMenuGroup(group.key)}
          className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
            isActive
              ? 'bg-blue-50 text-blue-600'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center">
            <group.icon className="h-5 w-5 mr-3" />
            {group.label}
          </div>
          <ChevronIcon className="h-4 w-4" />
        </button>
        {isExpanded && (
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-2 text-sm rounded-lg transition-colors ${
                  isMenuItemActive(item.href)
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="h-4 w-4 mr-3" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="p-6">
          <Link href="/dashboard" className="text-2xl font-bold text-blue-600">MedFlow</Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {menuStructure.map((item) =>
            item.type === 'item' ? renderMenuItem(item) : renderMenuGroup(item)
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center px-4 py-3 mb-2">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 shrink-0">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || 'Carregando...'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.role || 'Acessando...'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 px-4 flex items-center justify-between z-40">
        <h1 className="text-xl font-bold text-blue-600">MedFlow</h1>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`md:hidden fixed inset-y-0 left-0 w-72 bg-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex justify-between items-center border-b border-gray-200">
          <h1 className="text-2xl font-bold text-blue-600">MedFlow</h1>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {menuStructure.map((item) =>
            item.type === 'item' ? (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                  isMenuItemActive(item.href)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.label}
              </Link>
            ) : (
              <div key={item.key}>
                <button
                  onClick={() => toggleMenuGroup(item.key)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                    isMenuGroupActive(item)
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.label}
                  </div>
                  {expandedMenuGroups.has(item.key) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {expandedMenuGroups.has(item.key) && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                    {item.items.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center px-4 py-2 text-sm rounded-lg transition-colors ${
                          isMenuItemActive(subItem.href)
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <subItem.icon className="h-4 w-4 mr-3" />
                        {subItem.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center px-4 py-3 mb-2">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3 shrink-0">
              <User className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || 'Carregando...'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.role || 'Acessando...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsSidebarOpen(false);
              logout();
            }}
            className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto p-4 md:p-8 mt-16 md:mt-0">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

