# 📱 Guia de Acesso ao MedFlow no Celular

Este guia explica como acessar o MedFlow em dispositivos móveis (celular/tablet) na mesma rede Wi-Fi.

---

## 📋 Pré-requisitos

1. ✅ Computador e celular conectados na **mesma rede Wi-Fi**
2. ✅ MedFlow rodando no computador (`pnpm dev`)
3. ✅ Firewall do Windows permitindo conexões nas portas 3000 e 3001

---

## 🔧 Passo 1: Descobrir o IP do seu computador

### Windows (PowerShell ou CMD):
```powershell
ipconfig | findstr IPv4
```

Você verá algo como:
```
Endereço IPv4. . . . . . . .  . . . . . . . : 192.168.1.186
```

**Anote este IP!** (exemplo: `192.168.1.186`)

### Mac/Linux:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

---

## 🔧 Passo 2: Configurar Firewall do Windows

O Windows pode bloquear conexões externas. Siga estes passos:

1. Abra o **Painel de Controle** → **Firewall do Windows**
2. Clique em **Configurações Avançadas**
3. Clique em **Regras de Entrada** → **Nova Regra**
4. Selecione **Porta** → **Próximo**
5. Selecione **TCP** e digite: `3000,3001` → **Próximo**
6. Selecione **Permitir a conexão** → **Próximo**
7. Marque todas as opções → **Próximo**
8. Nome: "MedFlow Dev" → **Concluir**

**OU** execute no PowerShell como Administrador:
```powershell
New-NetFirewallRule -DisplayName "MedFlow Dev" -Direction Inbound -LocalPort 3000,3001 -Protocol TCP -Action Allow
```

---

## 🚀 Passo 3: Iniciar o MedFlow

No terminal do seu computador:
```bash
cd D:\Marco\PROJETOS_IA\MedFlow\medflow-repo\repo
pnpm dev
```

Aguarde até ver:
```
✓ Ready in X seconds
```

---

## 📱 Passo 4: Acessar no Celular

### No navegador do celular (Chrome, Safari, etc.):

1. Abra o navegador
2. Digite na barra de endereço:
   ```
   http://192.168.1.186:3000
   ```
   *(Substitua `192.168.1.186` pelo IP do seu computador)*

3. Você verá a tela de login do MedFlow!

### Credenciais para teste:
- **E-mail:** `admin@medflow.local`
- **Senha:** `admin123`

---

## 🎨 Funcionalidades Mobile

O MedFlow já está otimizado para mobile:

- ✅ **Menu hambúrguer** (☰) no canto superior direito
- ✅ **Sidebar deslizante** ao tocar no menu
- ✅ **Interface responsiva** que se adapta à tela
- ✅ **Touch-friendly** - botões e áreas de toque otimizadas

---

## 🔍 Solução de Problemas

### ❌ "Não consigo acessar"

**Problema:** Firewall bloqueando
- ✅ Verifique se o firewall está configurado (Passo 2)
- ✅ Tente desabilitar temporariamente o firewall para testar

**Problema:** IP incorreto
- ✅ Verifique se o IP mudou (execute `ipconfig` novamente)
- ✅ Certifique-se de que está na mesma rede Wi-Fi

**Problema:** Porta não acessível
- ✅ Verifique se o `pnpm dev` está rodando
- ✅ Tente acessar `http://192.168.1.186:3000` do próprio computador

### ❌ "Erro de CORS"

O CORS já está configurado para aceitar conexões de desenvolvimento. Se ainda houver erro:
- ✅ Verifique se está usando `http://` e não `https://`
- ✅ Limpe o cache do navegador do celular

### ❌ "Login não funciona"

**Problema:** API não acessível
- ✅ Verifique se a API está rodando na porta 3001
- ✅ Teste acessar `http://192.168.1.186:3001/auth/me` no navegador do celular
- ✅ O sistema detecta automaticamente o IP, mas se não funcionar, verifique o console do navegador

---

## 💡 Dicas

1. **Adicionar à Tela Inicial (iOS):**
   - No Safari, toque no botão de compartilhar (□↑)
   - Selecione "Adicionar à Tela de Início"
   - O MedFlow aparecerá como um app!

2. **Adicionar à Tela Inicial (Android):**
   - No Chrome, toque no menu (⋮)
   - Selecione "Adicionar à tela inicial"
   - O MedFlow aparecerá como um app!

3. **IP Dinâmico:**
   - Se o IP do seu computador mudar, você precisará atualizar o endereço no celular
   - Para evitar isso, configure um IP estático no roteador

---

## 🔐 Segurança

⚠️ **IMPORTANTE:** Este é um ambiente de desenvolvimento!

- ❌ **NÃO** use em produção sem HTTPS
- ❌ **NÃO** exponha para a internet (apenas rede local)
- ✅ Use apenas em rede Wi-Fi confiável
- ✅ Desative o firewall apenas temporariamente para testes

---

## 📞 Suporte

Se tiver problemas:
1. Verifique o console do navegador (F12 no computador, DevTools no celular)
2. Verifique os logs do terminal onde está rodando `pnpm dev`
3. Verifique se o banco de dados está rodando (`docker ps`)

---

**Última atualização:** 27 de Dezembro de 2024

