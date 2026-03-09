
# 🚀 AnimeEngine v7 (Control Center Edition)
**Acesse agora:** [animeengine.vercel.app](https://animeengine.vercel.app)

> A experiência definitiva, imersiva e responsiva de consumo de animes e cultura pop, agora com uma **Central de Configurações** totalmente revolucionária e baseada em Neo-Brutalismo.

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![Version](https://img.shields.io/badge/version-7.0.0-blue.svg)]()
[![PHP](https://img.shields.io/badge/php-8.1+-777bb4.svg)]()
[![JS](https://img.shields.io/badge/javascript-vanilla-yellow.svg)]()
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)]()
[![Interface](https://img.shields.io/badge/Interface-Neo_Brutalist-ff3366)]()

---

## 🌪️ O Que Há de Novo na v7?
A sétima versão da AnimeEngine foca em **Customização e Escalabilidade de Layout**. Transformamos a antiga modal de configurações em um gigantesco *"Control Center"* premium.

- **🎨 Themes & Visual Engine Dinâmico:** Uma nova arquitetura permitindo dezenas de temas (incluindo temas secretos bloqueáveis) com suporte a `color-mix` para glassmorphism universal.
- **📱 Responsividade Perfeita:** Telas massivas no PC (até 1200px) que colapsam inteligentemente para 1 coluna no celular.
- **✨ Active State Management:** Sistema de rastreamento nativo JS para gerenciar propriedades ativas via `Themes.getCurrent()`, parando bugs de dessincronização de cliques e cachê.
- **💾 Central de Perfil:** Estatísticas de progressão, XP via uso do simulador/calculadora.

## ✨ Temas Premium & Secretos
Experimente algumas das 17 skins épicas, descobrindo seus códigos pela [Calculadora]. Entre eles:
* `kauaMode`: Rainbow Supremo com neon flow e gradiente rotativo.
* `benevaMode`: Estilo MangaEngine (Laranja & Escuro).
* `xpMode`: O clássico Windows XP Luna com fontes em Tahoma e borders estriadas.
* `parafaMode`: High pink contrast glow.
* `cyberHacker`: Terminal OS com matrix background.

## 🛠️ Tecnologias Utilizadas
* **Backend:** PHP (com mysqli para alta performance)
* **Frontend:** HTML5, CSS3, e Vanilla JavaScript (ES6+ Modules)
* **Estilização:** CSS Variables Arquitetadas, flexbox, e CSS Grid avançados
* **Ícones:** FontAwesome
* **Armazenamento Local:** Wrapper otimizado `Storage.js` manipulando DBs do `localStorage` do usuário.

## 📁 Estrutura de Arquivos Responsável
*   📁 `css/style.css` - Design System principal, temas secretos e Media Queries mobile.
*   📁 `js/common.js` - Control Center modal builder, event listeners core de UI.
*   📁 `js/themes.js` - Theme Engine com proteção de acesso, storage proxying e render handlers.
*   📁 `js/storage.js` - Gestão stateful simulando um NoSQL leve para configurações offline-first.

---
**Build feito sob medida para Kauã e comunidade.** 🎬🤍✨
