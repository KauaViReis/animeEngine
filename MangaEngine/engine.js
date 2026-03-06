/**
 * MangaEngine v1.0
 * Motor de busca e leitura de mangás híbrido.
 * AniList (GraphQL) para metadados + MangaDex (REST) para conteúdo.
 *
 * @author MangaEngine
 */

const MangaEngine = (() => {
    'use strict';

    // =========================================================
    // CONSTANTS & STATE
    // =========================================================

    const ANILIST_URL = 'https://graphql.anilist.co';
    const MANGADEX_URL = 'https://api.mangadex.org';
    const FAVORITES_URL = 'save_fav.php';

    const ANILIST_QUERY = `
        query ($search: String, $page: Int, $perPage: Int) {
            Page(page: $page, perPage: $perPage) {
                pageInfo { total currentPage lastPage hasNextPage }
                media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
                    id
                    title { romaji english native }
                    coverImage { large medium }
                    bannerImage
                    averageScore
                    genres
                    description(asHtml: false)
                    status
                    chapters
                    volumes
                    startDate { year month }
                    format
                }
            }
        }
    `;

    // State
    let state = {
        currentSection: 'search',
        currentManga: null,       // AniList data do mangá selecionado
        mangadexId: null,         // MangaDex ID correspondente
        chapters: [],             // Lista de capítulos do MangaDex
        currentChapterIndex: -1,  // Índice do capítulo atual na lista
        favorites: new Set(),     // Set de anilist_ids favoritados
        searchTimeout: null,      // Debounce timer
        lastSearch: '',           // Última busca
    };

    // =========================================================
    // DOM REFERENCES
    // =========================================================

    const $ = (id) => document.getElementById(id);

    // =========================================================
    // UTILITY FUNCTIONS
    // =========================================================

    /** Debounce */
    function debounce(fn, delay) {
        return (...args) => {
            clearTimeout(state.searchTimeout);
            state.searchTimeout = setTimeout(() => fn(...args), delay);
        };
    }

    /** Toast notification */
    function showToast(message, type = 'info') {
        const container = $('toastContainer');
        const colors = {
            success: 'border-green-500 bg-green-500/10',
            error: 'border-red-500 bg-red-500/10',
            info: 'border-engine-orange bg-engine-orange/10',
        };

        const toast = document.createElement('div');
        toast.className = `glass rounded-lg px-4 py-3 border-l-4 ${colors[type] || colors.info} font-mono text-sm text-engine-text animate-slide-up max-w-sm`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /** Limpa HTML para texto puro */
    function stripHTML(html) {
        if (!html) return '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    /** Trunca texto */
    function truncate(str, len = 150) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '...' : str;
    }

    /** Formata score */
    function formatScore(score) {
        if (!score) return 'N/A';
        return score + '%';
    }

    /** Retorna o melhor título disponível */
    function getTitle(titleObj) {
        if (!titleObj) return 'Sem título';
        return titleObj.english || titleObj.romaji || titleObj.native || 'Sem título';
    }

    // =========================================================
    // SECTION NAVIGATION (SPA Router)
    // =========================================================

    function showSection(name) {
        const sections = ['search', 'details', 'reader', 'favorites'];
        sections.forEach(s => {
            const el = $('section' + s.charAt(0).toUpperCase() + s.slice(1));
            if (el) {
                if (s === name) {
                    el.classList.remove('section-hidden');
                } else {
                    el.classList.add('section-hidden');
                }
            }
        });
        state.currentSection = name;

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Load favorites when entering favorites section
        if (name === 'favorites') {
            loadFavorites();
        }
    }

    // =========================================================
    // ANILIST API — Busca de Mangás
    // =========================================================

    async function searchAniList(query) {
        if (!query || query.trim().length < 2) {
            $('searchResults').innerHTML = '';
            $('searchEmpty').classList.add('hidden');
            $('welcomeHero').classList.remove('hidden');
            return;
        }

        $('welcomeHero').classList.add('hidden');
        $('searchSpinner').classList.remove('hidden');
        $('searchEmpty').classList.add('hidden');

        try {
            const response = await fetch(ANILIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: ANILIST_QUERY,
                    variables: {
                        search: query.trim(),
                        page: 1,
                        perPage: 20
                    }
                })
            });

            if (!response.ok) throw new Error(`AniList API Error: ${response.status}`);

            const json = await response.json();
            const media = json?.data?.Page?.media || [];

            renderSearchResults(media);

            if (media.length === 0) {
                $('searchEmpty').classList.remove('hidden');
            }

        } catch (error) {
            console.error('AniList Error:', error);
            showToast('Erro ao buscar no AniList: ' + error.message, 'error');
            $('searchResults').innerHTML = '';
            $('searchEmpty').classList.remove('hidden');
        } finally {
            $('searchSpinner').classList.add('hidden');
        }
    }

    /** Renderizar cards de resultado */
    function renderSearchResults(mediaList) {
        const container = $('searchResults');
        container.innerHTML = '';

        mediaList.forEach((manga, index) => {
            const card = document.createElement('div');
            card.className = 'manga-card bg-engine-card rounded-lg overflow-hidden border border-engine-border border-l-4 border-l-engine-orange cursor-pointer animate-slide-up';
            card.style.animationDelay = `${index * 0.05}s`;
            card.onclick = () => selectManga(manga);

            const score = manga.averageScore;
            const scoreColor = score >= 75 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
            const genres = (manga.genres || []).slice(0, 3);

            card.innerHTML = `
                <div class="relative aspect-[3/4] overflow-hidden bg-engine-surface">
                    <img src="${manga.coverImage?.large || manga.coverImage?.medium || ''}"
                         alt="${getTitle(manga.title)}"
                         class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                         loading="lazy"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 400%22><rect fill=%22%2316161f%22 width=%22300%22 height=%22400%22/><text fill=%22%236b6b80%22 x=%22150%22 y=%22200%22 text-anchor=%22middle%22 font-size=%2216%22>Sem capa</text></svg>'">
                    ${score ? `<div class="absolute top-2 right-2 glass rounded-md px-2 py-0.5 ${scoreColor} font-mono text-xs font-bold">${formatScore(score)}</div>` : ''}
                    <div class="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-engine-card to-transparent"></div>
                </div>
                <div class="p-3">
                    <h3 class="text-sm font-display font-bold text-engine-text leading-tight line-clamp-2 mb-1.5" title="${getTitle(manga.title)}">
                        ${getTitle(manga.title)}
                    </h3>
                    <div class="flex flex-wrap gap-1">
                        ${genres.map(g => `<span class="genre-pill text-[10px] font-mono px-1.5 py-0.5 rounded border border-engine-border text-engine-muted">${g}</span>`).join('')}
                    </div>
                </div>
            `;

            container.appendChild(card);
        });
    }

    // =========================================================
    // MANGA DETAILS — AniList + MangaDex
    // =========================================================

    async function selectManga(manga) {
        state.currentManga = manga;
        state.mangadexId = null;
        state.chapters = [];
        state.currentChapterIndex = -1;

        showSection('details');
        renderMangaInfo(manga);

        // Buscar ID no MangaDex pelo título
        await findMangaDexId(manga);

        // Se encontrou, buscar capítulos
        if (state.mangadexId) {
            await loadChapters(state.mangadexId);
        }
    }

    /** Renderizar informações do mangá */
    function renderMangaInfo(manga) {
        const container = $('mangaInfo');
        const isFav = state.favorites.has(manga.id);
        const description = stripHTML(manga.description);

        container.innerHTML = `
            <div class="shrink-0">
                <img src="${manga.coverImage?.large || ''}"
                     alt="${getTitle(manga.title)}"
                     class="w-48 h-72 object-cover rounded-lg glow-orange-sm border border-engine-border">
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-4 mb-3">
                    <h1 class="text-3xl font-bold font-display text-engine-text leading-tight">
                        ${getTitle(manga.title)}
                    </h1>
                    <button onclick="MangaEngine.toggleFavorite()"
                            class="fav-btn shrink-0 p-2 rounded-lg border ${isFav ? 'border-engine-orange text-engine-orange' : 'border-engine-border text-engine-muted'} hover:border-engine-orange hover:text-engine-orange transition-all"
                            title="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}"
                            id="favButton">
                        <svg class="w-6 h-6" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                        </svg>
                    </button>
                </div>

                ${manga.title?.romaji && manga.title.romaji !== getTitle(manga.title) ?
                `<p class="text-engine-muted font-mono text-sm mb-3">${manga.title.romaji}</p>` : ''}

                <div class="flex flex-wrap items-center gap-3 mb-4">
                    ${manga.averageScore ? `
                        <div class="flex items-center gap-2">
                            <span class="text-engine-orange font-mono font-bold text-lg">${formatScore(manga.averageScore)}</span>
                            <div class="w-24 h-1.5 bg-engine-border rounded-full overflow-hidden">
                                <div class="score-bar h-full rounded-full" style="width: ${manga.averageScore}%"></div>
                            </div>
                        </div>
                    ` : ''}
                    ${manga.format ? `<span class="font-mono text-xs text-engine-muted bg-engine-surface px-2 py-1 rounded">${manga.format}</span>` : ''}
                    ${manga.status ? `<span class="font-mono text-xs text-engine-muted bg-engine-surface px-2 py-1 rounded">${manga.status}</span>` : ''}
                    ${manga.chapters ? `<span class="font-mono text-xs text-engine-muted bg-engine-surface px-2 py-1 rounded">${manga.chapters} caps</span>` : ''}
                    ${manga.volumes ? `<span class="font-mono text-xs text-engine-muted bg-engine-surface px-2 py-1 rounded">${manga.volumes} vols</span>` : ''}
                </div>

                <div class="flex flex-wrap gap-1.5 mb-4">
                    ${(manga.genres || []).map(g => `<span class="genre-pill text-xs font-mono px-2 py-1 rounded-md border border-engine-border text-engine-muted hover:text-engine-orange">${g}</span>`).join('')}
                </div>

                ${description ? `
                    <p class="text-engine-text/80 text-sm leading-relaxed font-light max-h-32 overflow-y-auto pr-2">
                        ${truncate(description, 500)}
                    </p>
                ` : ''}
            </div>
        `;
    }

    // =========================================================
    // MANGADEX API — Buscar ID e Capítulos
    // =========================================================

    async function findMangaDexId(manga) {
        $('chaptersLoading').classList.remove('hidden');
        $('chaptersList').innerHTML = '';
        $('chaptersEmpty').classList.add('hidden');

        const title = getTitle(manga.title);

        try {
            const res = await fetch(`${MANGADEX_URL}/manga?title=${encodeURIComponent(title)}&limit=5&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&includes[]=cover_art`);
            if (!res.ok) throw new Error(`MangaDex Search Error: ${res.status}`);

            const json = await res.json();
            const results = json?.data || [];

            if (results.length > 0) {
                // Tentar encontrar a melhor correspondência
                const match = results.find(m => {
                    const attrs = m.attributes;
                    const titles = [
                        attrs.title?.en,
                        attrs.title?.ja,
                        attrs.title?.['ja-ro'],
                        ...(attrs.altTitles || []).map(t => Object.values(t)[0])
                    ].filter(Boolean).map(t => t.toLowerCase());
                    return titles.some(t => t === title.toLowerCase());
                }) || results[0]; // Fallback para o primeiro resultado

                state.mangadexId = match.id;
            } else {
                $('chaptersLoading').classList.add('hidden');
                $('chaptersEmpty').classList.remove('hidden');
                showToast('Mangá não encontrado no MangaDex.', 'info');
            }

        } catch (error) {
            console.error('MangaDex Search Error:', error);
            $('chaptersLoading').classList.add('hidden');
            showToast('Erro ao buscar no MangaDex: ' + error.message, 'error');
        }
    }

    async function loadChapters(mangadexId) {
        $('chaptersLoading').classList.remove('hidden');
        $('chaptersList').innerHTML = '';
        $('chaptersEmpty').classList.add('hidden');

        try {
            // Buscar capítulos em múltiplos idiomas (en + pt-br)
            const languages = ['en', 'pt-br'];
            let allChapters = [];

            for (const lang of languages) {
                let offset = 0;
                const limit = 100;
                let hasMore = true;

                while (hasMore && offset < 1000) {
                    const res = await fetch(
                        `${MANGADEX_URL}/manga/${mangadexId}/feed?translatedLanguage[]=${lang}&order[chapter]=asc&limit=${limit}&offset=${offset}&includes[]=scanlation_group`
                    );

                    if (!res.ok) throw new Error(`MangaDex Feed Error: ${res.status}`);

                    const json = await res.json();
                    const data = json?.data || [];
                    allChapters = allChapters.concat(data);

                    hasMore = data.length === limit;
                    offset += limit;

                    // Rate limit: small delay entre requests
                    if (hasMore) await new Promise(r => setTimeout(r, 300));
                }

                // Pequeno delay entre idiomas
                await new Promise(r => setTimeout(r, 200));
            }

            // Separar capítulos legíveis (com páginas no MangaDex) de externos (links)
            // Prioridade: capítulos com páginas > capítulos externos
            const chapterMap = new Map(); // chapterNumber -> melhor capítulo

            allChapters.forEach(ch => {
                const num = ch.attributes?.chapter;
                if (!num) return;

                const isExternal = !!ch.attributes?.externalUrl;
                const hasPages = (ch.attributes?.pages || 0) > 0;
                const existing = chapterMap.get(num);

                if (!existing) {
                    chapterMap.set(num, ch);
                } else {
                    const existingIsExternal = !!existing.attributes?.externalUrl;
                    const existingHasPages = (existing.attributes?.pages || 0) > 0;

                    // Preferir capítulo com páginas reais sobre externo
                    if (!existingHasPages && hasPages) {
                        chapterMap.set(num, ch);
                    }
                    // Se ambos têm páginas, preferir pt-br se existente é en
                    // (apenas para dar variedade, mas em geral o primeiro é ok)
                }
            });

            // Ordenar por número do capítulo
            state.chapters = Array.from(chapterMap.values()).sort((a, b) => {
                const numA = parseFloat(a.attributes?.chapter || '0');
                const numB = parseFloat(b.attributes?.chapter || '0');
                return numA - numB;
            });

            renderChapters(state.chapters);

            if (state.chapters.length === 0) {
                $('chaptersEmpty').classList.remove('hidden');
            }

        } catch (error) {
            console.error('MangaDex Chapters Error:', error);
            showToast('Erro ao carregar capítulos: ' + error.message, 'error');
        } finally {
            $('chaptersLoading').classList.add('hidden');
        }
    }

    /** Renderizar lista de capítulos */
    function renderChapters(chapters) {
        const container = $('chaptersList');
        container.innerHTML = '';

        const readableCount = chapters.filter(ch => !ch.attributes?.externalUrl).length;
        const externalCount = chapters.length - readableCount;

        let countText = `${chapters.length} capítulo(s) encontrado(s)`;
        if (externalCount > 0 && readableCount > 0) {
            countText += ` — ${readableCount} legível(is), ${externalCount} externo(s)`;
        } else if (externalCount > 0 && readableCount === 0) {
            countText += ` — todos externos (links oficiais)`;
        }
        $('chapterCount').textContent = countText;

        chapters.forEach((ch, index) => {
            const attrs = ch.attributes || {};
            const chNum = attrs.chapter || '?';
            const chTitle = attrs.title || '';
            const group = ch.relationships?.find(r => r.type === 'scanlation_group');
            const groupName = group?.attributes?.name || 'Grupo desconhecido';
            const pages = attrs.pages || 0;
            const isExternal = !!attrs.externalUrl;
            const lang = attrs.translatedLanguage || 'en';
            const langLabel = lang === 'pt-br' ? 'PT-BR' : lang.toUpperCase();

            const item = document.createElement('div');
            item.className = `chapter-item flex items-center justify-between p-3 rounded-lg border border-engine-border border-l-4 ${isExternal ? 'border-l-blue-500/50' : 'border-l-transparent'} cursor-pointer hover:border-l-engine-orange transition-all`;

            item.onclick = () => openReader(index);

            item.innerHTML = `
                <div class="flex items-center gap-3 min-w-0">
                    <span class="text-engine-orange font-mono font-bold text-sm shrink-0 w-16">Cap. ${chNum}</span>
                    <div class="min-w-0">
                        <p class="text-engine-text text-sm font-display truncate">
                            ${chTitle || `Capítulo ${chNum}`}
                        </p>
                        <p class="text-engine-muted font-mono text-xs truncate">${groupName}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="font-mono text-[10px] px-1.5 py-0.5 rounded border ${lang === 'pt-br' ? 'border-green-500/40 text-green-400' : 'border-engine-border text-engine-muted'}">${langLabel}</span>
                    ${isExternal ? `
                        <span class="font-mono text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 text-blue-400 flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                            </svg>
                            Externo
                        </span>
                    ` : `<span class="text-engine-muted font-mono text-xs">${pages}p</span>`}
                    <svg class="w-4 h-4 text-engine-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isExternal ? 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' : 'M9 5l7 7-7 7'}"/>
                    </svg>
                </div>
            `;

            container.appendChild(item);
        });
    }

    // =========================================================
    // READER — Leitor Vertical
    // =========================================================

    async function openReader(chapterIndex) {
        if (chapterIndex < 0 || chapterIndex >= state.chapters.length) return;

        state.currentChapterIndex = chapterIndex;
        const chapter = state.chapters[chapterIndex];
        const chapterId = chapter.id;
        const chNum = chapter.attributes?.chapter || '?';
        const chTitle = chapter.attributes?.title || `Capítulo ${chNum}`;

        showSection('reader');

        // Update reader title
        const readerTitle = $('readerTitle');
        readerTitle.querySelector('p:first-child').textContent = getTitle(state.currentManga.title);
        readerTitle.querySelector('p:last-child').textContent = `Capítulo ${chNum} — ${chTitle}`;

        // Update nav buttons
        $('btnPrevChapter').disabled = chapterIndex <= 0;
        $('btnNextChapter').disabled = chapterIndex >= state.chapters.length - 1;

        // Se o capítulo é externo (MangaPlus/Viz), embutir via iframe
        if (chapter.attributes?.externalUrl) {
            const externalUrl = chapter.attributes.externalUrl;
            const group = chapter.relationships?.find(r => r.type === 'scanlation_group');
            const groupName = group?.attributes?.name || 'Site Oficial';

            $('readerLoading').classList.add('hidden');
            $('readerBottomNav').classList.remove('hidden');
            $('readerPages').innerHTML = `
                <div class="relative w-full rounded-lg overflow-hidden border border-engine-border" style="height: calc(100vh - 180px); min-height: 500px;">
                    <iframe
                        id="externalReaderFrame"
                        src="${externalUrl}"
                        class="w-full h-full border-0 bg-white rounded-lg"
                        allow="fullscreen"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
                        loading="eager"
                        title="Leitura externa — Capítulo ${chNum}"
                    ></iframe>
                    <div id="iframeOverlay" class="absolute inset-0 flex flex-col items-center justify-center glass rounded-lg hidden">
                        <svg class="w-16 h-16 text-engine-orange mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                        </svg>
                        <p class="text-engine-text font-display font-bold text-lg mb-2">Leitura externa bloqueada</p>
                        <p class="text-engine-muted font-mono text-sm mb-1 text-center max-w-md">
                            O ${groupName} não permite leitura embutida.
                        </p>
                        <p class="text-engine-muted/60 font-mono text-xs mb-6 text-center max-w-md">
                            Clique abaixo para abrir diretamente no site oficial.
                        </p>
                        <a href="${externalUrl}" target="_blank" rel="noopener noreferrer"
                           class="px-6 py-3 rounded-lg bg-engine-orange/20 border border-engine-orange text-engine-orange font-mono text-sm hover:bg-engine-orange/30 transition-all flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                            </svg>
                            Abrir no ${groupName}
                        </a>
                    </div>
                </div>
                <div class="flex items-center justify-center gap-3 mt-3">
                    <span class="font-mono text-[10px] px-2 py-1 rounded border border-blue-500/30 text-blue-400 flex items-center gap-1.5">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                        Leitura via ${groupName}
                    </span>
                    <a href="${externalUrl}" target="_blank" rel="noopener noreferrer"
                       class="font-mono text-[10px] px-2 py-1 rounded border border-engine-border text-engine-muted hover:text-engine-orange hover:border-engine-orange transition-all">
                        Abrir em nova aba ↗
                    </a>
                </div>
            `;

            // Detectar se o iframe foi bloqueado (X-Frame-Options / CSP)
            const iframe = $('externalReaderFrame');
            const overlay = $('iframeOverlay');

            // Timeout: se não carregou em 5s, provavelmente bloqueado
            const iframeTimeout = setTimeout(() => {
                overlay.classList.remove('hidden');
            }, 5000);

            iframe.addEventListener('load', () => {
                clearTimeout(iframeTimeout);
                try {
                    // Tentar acessar o conteúdo — se bloqueado por CORS, vai lançar erro
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (!doc || doc.body?.innerHTML === '') {
                        overlay.classList.remove('hidden');
                    }
                } catch (e) {
                    // Cross-origin — o iframe carregou, está tudo ok
                    // (se deu erro de acesso é porque carregou mas é cross-origin)
                }
            });

            iframe.addEventListener('error', () => {
                clearTimeout(iframeTimeout);
                overlay.classList.remove('hidden');
            });

            showToast(`Leitura via ${groupName} — Cap. ${chNum}`, 'info');
            return;
        }

        // Load pages
        $('readerLoading').classList.remove('hidden');
        $('readerPages').innerHTML = '';
        $('readerBottomNav').classList.add('hidden');

        try {
            // Retry com até 3 tentativas e delay progressivo
            let json = null;
            let lastError = null;
            const maxRetries = 3;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const res = await fetch(`${MANGADEX_URL}/at-home/server/${chapterId}`);

                    if (res.status === 404) {
                        throw new Error('Capítulo não disponível no servidor MangaDex (404).');
                    }

                    if (res.status === 429) {
                        // Rate limited — esperar mais antes de tentar novamente
                        const waitTime = attempt * 2000;
                        console.warn(`Rate limited (429). Aguardando ${waitTime}ms antes de tentar novamente...`);
                        showToast(`Rate limit atingido. Tentando novamente em ${waitTime / 1000}s...`, 'info');
                        await new Promise(r => setTimeout(r, waitTime));
                        continue;
                    }

                    if (!res.ok) {
                        throw new Error(`At-Home Error: ${res.status}`);
                    }

                    json = await res.json();
                    break; // Sucesso, sair do loop

                } catch (err) {
                    lastError = err;
                    // Se for 404 (capítulo não existe), não adianta tentar novamente
                    if (err.message.includes('404')) {
                        break;
                    }
                    // Para outros erros, tentar novamente com delay
                    if (attempt < maxRetries) {
                        const waitTime = attempt * 1000;
                        console.warn(`Tentativa ${attempt} falhou. Retentando em ${waitTime}ms...`, err.message);
                        await new Promise(r => setTimeout(r, waitTime));
                    }
                }
            }

            if (!json) {
                throw lastError || new Error('Falha ao conectar com o servidor At-Home.');
            }

            const baseUrl = json.baseUrl;
            const hash = json.chapter?.hash;
            // Tentar usar 'data' (qualidade total), senão usar 'dataSaver' (comprimido)
            let pages = json.chapter?.data || [];
            let usingSaver = false;

            if (pages.length === 0) {
                pages = json.chapter?.dataSaver || [];
                usingSaver = true;
            }

            if (pages.length === 0) {
                throw new Error('Nenhuma página encontrada neste capítulo.');
            }

            if (usingSaver) {
                showToast('Usando imagens comprimidas (dataSaver).', 'info');
            }

            renderPages(baseUrl, hash, pages, usingSaver);

        } catch (error) {
            console.error('Reader Error:', error);
            showToast('Erro ao carregar páginas: ' + error.message, 'error');

            const is404 = error.message.includes('404');

            $('readerPages').innerHTML = `
                <div class="text-center py-16">
                    <svg class="w-16 h-16 text-engine-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${is404
                    ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                    : 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z'}"/>
                    </svg>
                    <p class="text-engine-muted font-mono text-sm mb-2">${is404
                    ? 'Este capítulo não está disponível no MangaDex.'
                    : 'Erro ao carregar o capítulo.'}</p>
                    <p class="text-engine-muted/60 font-mono text-xs mb-4">${error.message}</p>
                    ${is404 ? `
                        <p class="text-engine-muted/40 font-mono text-xs mb-6">
                            O capítulo pode ter sido removido, transferido ou está temporariamente indisponível.
                        </p>
                    ` : ''}
                    <button onclick="MangaEngine.showSection('details')"
                            class="px-4 py-2 rounded-lg bg-engine-surface border border-engine-border hover:border-engine-orange text-engine-muted hover:text-engine-orange font-mono text-sm transition-all">
                        ← Voltar aos capítulos
                    </button>
                </div>
            `;
        } finally {
            $('readerLoading').classList.add('hidden');
        }
    }

    /** Renderizar páginas do leitor */
    function renderPages(baseUrl, hash, pages, usingSaver = false) {
        const container = $('readerPages');
        container.innerHTML = '';

        const pathSegment = usingSaver ? 'data-saver' : 'data';

        pages.forEach((filename, index) => {
            const url = `${baseUrl}/${pathSegment}/${hash}/${filename}`;

            const wrapper = document.createElement('div');
            wrapper.className = 'relative bg-engine-surface rounded-md overflow-hidden animate-fade-in';
            wrapper.style.animationDelay = `${index * 0.05}s`;

            wrapper.innerHTML = `
                <div class="page-placeholder flex items-center justify-center py-20">
                    <div class="spinner"></div>
                </div>
                <img src="${url}"
                     alt="Página ${index + 1}"
                     class="page-img w-full h-auto"
                     loading="lazy"
                     onload="this.classList.add('loaded'); this.previousElementSibling.style.display='none';"
                     onerror="this.previousElementSibling.innerHTML='<p class=\\'text-engine-muted font-mono text-sm\\'>Erro ao carregar página ${index + 1}</p>';">
            `;

            container.appendChild(wrapper);
        });

        // Show bottom navigation
        $('readerBottomNav').classList.remove('hidden');
    }

    /** Navegar capítulo anterior */
    function prevChapter() {
        if (state.currentChapterIndex > 0) {
            openReader(state.currentChapterIndex - 1);
        }
    }

    /** Navegar próximo capítulo */
    function nextChapter() {
        if (state.currentChapterIndex < state.chapters.length - 1) {
            openReader(state.currentChapterIndex + 1);
        }
    }

    // =========================================================
    // FAVORITES — Sistema de Favoritos (PHP/MySQLi)
    // =========================================================

    /** Toggle favorito */
    async function toggleFavorite() {
        const manga = state.currentManga;
        if (!manga) return;

        const isFav = state.favorites.has(manga.id);

        try {
            if (isFav) {
                // Remover
                const res = await fetch(FAVORITES_URL, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ anilist_id: manga.id })
                });
                const json = await res.json();
                if (json.success) {
                    state.favorites.delete(manga.id);
                    showToast('Removido dos favoritos!', 'info');
                } else {
                    throw new Error(json.error || 'Erro ao remover');
                }
            } else {
                // Adicionar
                const res = await fetch(FAVORITES_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        anilist_id: manga.id,
                        mangadex_id: state.mangadexId || null,
                        title: getTitle(manga.title),
                        cover_url: manga.coverImage?.large || manga.coverImage?.medium || ''
                    })
                });
                const json = await res.json();
                if (json.success) {
                    state.favorites.add(manga.id);
                    showToast('Adicionado aos favoritos!', 'success');
                } else {
                    throw new Error(json.error || 'Erro ao salvar');
                }
            }

            // Atualizar botão
            renderMangaInfo(manga);

        } catch (error) {
            console.error('Favorite Error:', error);
            showToast('Erro nos favoritos: ' + error.message, 'error');
        }
    }

    /** Carregar lista de favoritos */
    async function loadFavorites() {
        $('favoritesLoading').classList.remove('hidden');
        $('favoritesGrid').innerHTML = '';
        $('favoritesEmpty').classList.add('hidden');

        try {
            const res = await fetch(FAVORITES_URL);
            const json = await res.json();

            if (!json.success) throw new Error(json.error || 'Erro ao carregar');

            const data = json.data || [];

            // Atualizar set de favoritos
            state.favorites = new Set(data.map(f => parseInt(f.anilist_id)));

            renderFavorites(data);

            if (data.length === 0) {
                $('favoritesEmpty').classList.remove('hidden');
            }

        } catch (error) {
            console.error('Load Favorites Error:', error);
            // Se o servidor PHP não está rodando, mostrar mensagem amigável
            $('favoritesEmpty').classList.remove('hidden');
            $('favoritesEmpty').innerHTML = `
                <svg class="w-16 h-16 text-engine-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
                <p class="text-engine-muted font-mono text-sm mb-2">Servidor PHP não disponível.</p>
                <p class="text-engine-muted/60 font-mono text-xs">Inicie o XAMPP/PHP para ativar o sistema de favoritos.</p>
            `;
        } finally {
            $('favoritesLoading').classList.add('hidden');
        }
    }

    /** Renderizar grid de favoritos */
    function renderFavorites(favorites) {
        const container = $('favoritesGrid');
        container.innerHTML = '';

        favorites.forEach((fav, index) => {
            const card = document.createElement('div');
            card.className = 'manga-card bg-engine-card rounded-lg overflow-hidden border border-engine-border border-l-4 border-l-engine-orange relative group animate-slide-up';
            card.style.animationDelay = `${index * 0.05}s`;

            card.innerHTML = `
                <div class="relative aspect-[3/4] overflow-hidden bg-engine-surface cursor-pointer" onclick="MangaEngine.openFavorite(${fav.anilist_id}, '${(fav.mangadex_id || '').replace(/'/g, "\\'")}')">
                    <img src="${fav.cover_url || ''}"
                         alt="${fav.title}"
                         class="w-full h-full object-cover"
                         loading="lazy"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 400%22><rect fill=%22%2316161f%22 width=%22300%22 height=%22400%22/><text fill=%22%236b6b80%22 x=%22150%22 y=%22200%22 text-anchor=%22middle%22 font-size=%2216%22>Sem capa</text></svg>'">
                    <div class="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-engine-card to-transparent"></div>
                </div>
                <div class="p-3 flex items-start justify-between gap-2">
                    <h3 class="text-sm font-display font-bold text-engine-text leading-tight line-clamp-2 cursor-pointer" onclick="MangaEngine.openFavorite(${fav.anilist_id}, '${(fav.mangadex_id || '').replace(/'/g, "\\'")}')" title="${fav.title}">
                        ${fav.title}
                    </h3>
                    <button onclick="MangaEngine.removeFavorite(${fav.anilist_id})"
                            class="shrink-0 p-1 rounded text-engine-muted hover:text-red-400 transition-colors"
                            title="Remover">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            `;

            container.appendChild(card);
        });
    }

    /** Remover favorito */
    async function removeFavorite(anilistId) {
        try {
            const res = await fetch(FAVORITES_URL, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ anilist_id: anilistId })
            });
            const json = await res.json();

            if (json.success) {
                state.favorites.delete(anilistId);
                showToast('Favorito removido!', 'info');
                loadFavorites(); // Refresh
            } else {
                throw new Error(json.error);
            }
        } catch (error) {
            showToast('Erro ao remover: ' + error.message, 'error');
        }
    }

    /** Abrir favorito — busca no AniList e redireciona para detalhes */
    async function openFavorite(anilistId, mangadexId) {
        showToast('Carregando mangá...', 'info');

        try {
            const query = `
                query ($id: Int) {
                    Media(id: $id, type: MANGA) {
                        id title { romaji english native }
                        coverImage { large medium } bannerImage
                        averageScore genres description(asHtml: false)
                        status chapters volumes startDate { year month } format
                    }
                }
            `;
            const res = await fetch(ANILIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { id: anilistId } })
            });

            const json = await res.json();
            const manga = json?.data?.Media;

            if (manga) {
                state.currentManga = manga;
                state.mangadexId = mangadexId || null;
                showSection('details');
                renderMangaInfo(manga);

                if (mangadexId) {
                    await loadChapters(mangadexId);
                } else {
                    await findMangaDexId(manga);
                    if (state.mangadexId) {
                        await loadChapters(state.mangadexId);
                    }
                }
            }
        } catch (error) {
            showToast('Erro ao abrir favorito: ' + error.message, 'error');
        }
    }

    // =========================================================
    // INITIALIZATION
    // =========================================================

    function init() {
        // Search input with debounce
        const searchInput = $('searchInput');
        const debouncedSearch = debounce(searchAniList, 400);

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (query !== state.lastSearch) {
                state.lastSearch = query;
                debouncedSearch(query);
            }
        });

        // Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(state.searchTimeout);
                searchAniList(searchInput.value);
            }
        });

        // Focus search on '/' key
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && document.activeElement !== searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
            // Escape to go back
            if (e.key === 'Escape') {
                if (state.currentSection === 'reader') showSection('details');
                else if (state.currentSection === 'details') showSection('search');
                else if (state.currentSection === 'favorites') showSection('search');
            }
        });

        // Load favorites set (sem renderizar, só para saber quais estão favoritados)
        loadFavoritesSet();

        console.log(
            '%c⚙ MangaEngine v1.0 %cInitialized',
            'color: #ff6600; font-weight: bold; font-size: 14px;',
            'color: #6b6b80; font-size: 12px;'
        );
    }

    /** Carregar apenas o Set de favorites IDs */
    async function loadFavoritesSet() {
        try {
            const res = await fetch(FAVORITES_URL);
            const json = await res.json();
            if (json.success) {
                state.favorites = new Set(json.data.map(f => parseInt(f.anilist_id)));
            }
        } catch (e) {
            // PHP provavelmente não está rodando. Sem problemas.
        }
    }

    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================================
    // PUBLIC API
    // =========================================================

    return {
        showSection,
        toggleFavorite,
        removeFavorite,
        openFavorite,
        prevChapter,
        nextChapter,
    };

})();
