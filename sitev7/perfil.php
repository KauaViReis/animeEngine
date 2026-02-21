<?php
/**
 * AnimeEngine v7 - Perfil do Usuário
 * Com personalização avançada
 */

require_once 'includes/auth.php';

// Verificar se está vendo perfil próprio ou de outro
$username_param = $_GET['user'] ?? null;
$viewing_own = false;

if ($username_param) {
    // Ver perfil de outro
    $conn = conectar();
    $username_safe = escape($conn, $username_param);
    $sql = "SELECT * FROM usuarios WHERE username = '$username_safe'";
    $result = mysqli_query($conn, $sql);

    if (mysqli_num_rows($result) === 0) {
        mysqli_close($conn);
        header('Location: index.php');
        exit;
    }

    $usuario = mysqli_fetch_assoc($result);

    // Verificar privacidade
    if (!$usuario['perfil_publico'] && (!estaLogado() || getUsuarioId() != $usuario['id'])) {
        mysqli_close($conn);
        die('Este perfil é privado.');
    }

    $viewing_own = estaLogado() && getUsuarioId() == $usuario['id'];
    mysqli_close($conn);
} else {
    // Ver próprio perfil
    if (!estaLogado()) {
        header('Location: login.php?redirect=perfil.php');
        exit;
    }

    $conn = conectar();
    $sql = "SELECT * FROM usuarios WHERE id = " . getUsuarioId();
    $result = mysqli_query($conn, $sql);
    $usuario = mysqli_fetch_assoc($result);
    mysqli_close($conn);
    $viewing_own = true;
}

$titulo_pagina = $usuario['username'] . ' - ANIME.ENGINE v7';
require_once 'includes/header.php';
require_once 'includes/nav.php';

// Dados
$nivelIcons = ['🌱', '🌿', '🍃', '🔥', '⚡', '💎', '🏆', '👑', '🌟', '🐉'];
$nivelNomes = ['Iniciante', 'Amador', 'Novato', 'Regular', 'Veterano', 'Expert', 'Mestre', 'Lenda', 'Supremo', 'Otaku Deus'];
$badges_exibidos = json_decode($usuario['badges_exibidos'] ?? '[]', true) ?: [];
?>

<main class="main-content">
    <div class="profile-container">
        <!-- HEADER DO PERFIL -->
        <!-- HEADER HERO MODERNO -->
        <div class="profile-content-wrapper">
            <!-- Banner Area -->
            <div class="profile-hero"
                style="background-image: url('<?= !empty($usuario['banner']) ? $usuario['banner'] : 'https://via.placeholder.com/1200x350?text=Banner' ?>')">

                <div class="profile-hero-content">
                    <!-- Avatar -->
                    <div class="profile-hero-avatar moldura-<?= $usuario['moldura'] ?? 'default' ?>">
                        <?php if (!empty($usuario['avatar'])): ?>
                            <img src="<?= htmlspecialchars($usuario['avatar']) ?>" alt="Avatar">
                        <?php else: ?>
                            <?= $nivelIcons[min(($usuario['nivel'] ?? 1) - 1, 9)] ?>
                        <?php endif; ?>
                    </div>

                    <!-- Info -->
                    <div class="profile-hero-info">
                        <div class="profile-hero-name-row">
                            <span class="profile-hero-status"><?= $usuario['status_emoji'] ?? '🎮' ?></span>
                            <h1 class="profile-hero-username cor-<?= $usuario['cor_nome'] ?? 'default' ?>">
                                <?= htmlspecialchars($usuario['username']) ?>
                            </h1>
                            <span class="level-badge-big">
                                <?= $nivelIcons[min(($usuario['nivel'] ?? 1) - 1, 9)] ?>
                                Nível <?= $usuario['nivel'] ?? 1 ?>
                            </span>
                        </div>

                        <?php
                        // Título Ativo
                        if (isset($usuario['titulo_ativo']) && $usuario['titulo_ativo']) {
                            $conn = conectar();
                            $sql = "SELECT nome, icone, cor FROM titulos WHERE id = " . intval($usuario['titulo_ativo']);
                            $result = mysqli_query($conn, $sql);
                            $titulo = mysqli_fetch_assoc($result);
                            mysqli_close($conn);
                            if ($titulo): ?>
                                <div class="profile-title" style="color: <?= $titulo['cor'] ?>; margin-top: 5px;">
                                    <?= $titulo['icone'] ?>         <?= $titulo['nome'] ?>
                                </div>
                            <?php endif;
                        }
                        ?>

                        <?php if (!empty($usuario['bio'])): ?>
                            <p class="profile-hero-bio"><?= nl2br(htmlspecialchars($usuario['bio'])) ?></p>
                        <?php endif; ?>

                        <!-- XP Bar Mini -->
                        <div class="profile-xp" style="margin-top: 10px;">
                            <div class="xp-bar" style="width: 150px; height: 6px;">
                                <div class="xp-fill" style="width: <?= min(($usuario['xp'] ?? 0) % 100, 100) ?>%"></div>
                            </div>
                            <span style="font-size: 0.8rem; opacity: 0.8;"><?= $usuario['xp'] ?? 0 ?> XP</span>
                        </div>
                    </div>

                    <!-- Redes Sociais -->
                    <?php
                    $socials = json_decode($usuario['redes_sociais'] ?? '{}', true) ?: [];
                    if (!empty($socials)): ?>
                        <div class="profile-hero-socials">
                            <?php if (!empty($socials['discord'])): ?>
                                <button class="social-icon discord"
                                    title="Discord: <?= htmlspecialchars($socials['discord']) ?>"
                                    onclick="navigator.clipboard.writeText('<?= htmlspecialchars($socials['discord']) ?>'); alert('Discord copiado: <?= htmlspecialchars($socials['discord']) ?>')">
                                    <i class="fab fa-discord"></i>
                                </button>
                            <?php endif; ?>

                            <?php if (!empty($socials['twitter'])): ?>
                                <a href="https://twitter.com/<?= htmlspecialchars($socials['twitter']) ?>" target="_blank"
                                    class="social-icon twitter">
                                    <i class="fab fa-twitter"></i>
                                </a>
                            <?php endif; ?>

                            <?php if (!empty($socials['instagram'])): ?>
                                <a href="https://instagram.com/<?= htmlspecialchars($socials['instagram']) ?>" target="_blank"
                                    class="social-icon instagram">
                                    <i class="fab fa-instagram"></i>
                                </a>
                            <?php endif; ?>

                            <?php if (!empty($socials['youtube'])): ?>
                                <a href="<?= strpos($socials['youtube'], 'http') === 0 ? htmlspecialchars($socials['youtube']) : 'https://youtube.com/@' . htmlspecialchars($socials['youtube']) ?>"
                                    target="_blank" class="social-icon youtube">
                                    <i class="fab fa-youtube"></i>
                                </a>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>

                    <!-- Actions -->
                    <div class="profile-hero-actions">
                        <?php if ($viewing_own): ?>
                            <a href="editar_perfil.php" class="btn btn-secondary btn-sm" style="border-radius: 50px;">
                                <i class="fas fa-edit"></i> Editar
                            </a>
                        <?php else: ?>
                            <button class="btn btn-primary btn-sm" id="follow-btn" onclick="toggleFollow()"
                                style="border-radius: 50px;">
                                <i class="fas fa-user-plus"></i> Seguir
                            </button>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>

        <!-- STATS -->
        <div class="profile-stats" id="profile-stats">
            <div class="carousel-loading">
                <div class="loader"></div>
            </div>
        </div>

        <!-- ATIVIDADE RECENTE -->
        <div class="profile-section">
            <h2><i class="fas fa-history"></i> Atividade Recente</h2>
            <div class="activity-feed" id="activity-feed">
                <div class="carousel-loading">
                    <div class="loader"></div>
                </div>
            </div>
        </div>

        <!-- ANIMES COMPLETOS -->
        <div class="profile-section">
            <h2><i class="fas fa-check-circle"></i> Animes Completos</h2>
            <div class="completed-animes-grid" id="completed-animes">
                <div class="carousel-loading">
                    <div class="loader"></div>
                </div>
            </div>
        </div>

        <!-- CONQUISTAS -->
        <div class="achievements-section">
            <h2><i class="fas fa-trophy"></i> Conquistas</h2>
            <p class="achievements-summary" id="achievements-summary">Carregando...</p>
            <div class="achievements-grid" id="achievements-grid">
                <div class="carousel-loading">
                    <div class="loader"></div>
                </div>
            </div>
        </div>

        <!-- COMENTÁRIOS / MURAL -->
        <div class="profile-section comments-section">
            <h2><i class="fas fa-comments"></i> Mural</h2>

            <?php if (estaLogado()): ?>
                <form class="comment-form" id="comment-form">
                    <textarea id="comment-input" placeholder="Deixe um comentário..." maxlength="500"></textarea>
                    <button type="submit" class="btn btn-primary btn-sm">
                        <i class="fas fa-paper-plane"></i> Enviar
                    </button>
                </form>
            <?php else: ?>
                <p class="login-prompt"><a href="login.php">Faça login</a> para comentar</p>
            <?php endif; ?>

            <div class="comments-list" id="comments-list">
                <div class="carousel-loading">
                    <div class="loader"></div>
                </div>
            </div>
        </div>
    </div>
</main>



<script>
    const profileUserId = <?= $usuario['id'] ?>;
    const viewingOwn = <?= $viewing_own ? 'true' : 'false' ?>;

    document.addEventListener('DOMContentLoaded', async () => {
        // Carregar stats
        try {
            const response = await fetch('api/users/stats.php');
            const stats = await response.json();

            // Carregar streak
            const streakRes = await fetch('api/users/streak.php');
            const streakData = await streakRes.json();

            document.getElementById('profile-stats').innerHTML = `
            <div class="profile-stat-card">
                <div class="profile-stat-value">${stats.totalAnimes}</div>
                <div class="profile-stat-label">Animes</div>
            </div>
            <div class="profile-stat-card">
                <div class="profile-stat-value">${stats.completed}</div>
                <div class="profile-stat-label">Completos</div>
            </div>
            <div class="profile-stat-card streak-card">
                <div class="profile-stat-value">🔥 ${streakData.streak_atual || 0}</div>
                <div class="profile-stat-label">Streak Dias</div>
                <div class="streak-max">Recorde: ${streakData.streak_max || 0}</div>
            </div>
            <div class="profile-stat-card">
                <div class="profile-stat-value">${stats.achievements}</div>
                <div class="profile-stat-label">Conquistas</div>
            </div>
        `;
        } catch (e) { console.error(e); }

        // Carregar atividade recente
        try {
            const actRes = await fetch(`api/users/atividade.php?user_id=${profileUserId}`);
            const activities = await actRes.json();

            const actContainer = document.getElementById('activity-feed');
            if (activities.length === 0) {
                actContainer.innerHTML = '<p class="empty-message">Nenhuma atividade ainda</p>';
            } else {
                actContainer.innerHTML = activities.slice(0, 10).map(a => `
                <div class="activity-item">
                    ${a.anime_imagem ? `<img src="${a.anime_imagem}" class="activity-thumb">` : '<span class="activity-icon">📝</span>'}
                    <div class="activity-content">
                        <div class="activity-text">${a.texto}</div>
                        <div class="activity-time">${a.tempo}</div>
                    </div>
                </div>
            `).join('');
            }
        } catch (e) { console.error(e); }

        // Carregar animes completos
        try {
            const response = await fetch('api/lists/get.php');
            const data = await response.json();
            const completed = data.lists?.completed || [];

            const container = document.getElementById('completed-animes');

            if (completed.length === 0) {
                container.innerHTML = '<p>Nenhum anime completo ainda</p>';
            } else {
                container.innerHTML = completed.slice(0, 12).map(anime => `
                <div class="completed-anime-card" onclick="window.location='detalhes.php?id=${anime.anime_id}'">
                    <img src="${anime.imagem}" alt="${anime.titulo}">
                    ${anime.nota ? `<div class="anime-rating">⭐ ${anime.nota}</div>` : ''}
                </div>
            `).join('');
            }
        } catch (e) {
            document.getElementById('completed-animes').innerHTML = '<p>Erro ao carregar</p>';
        }

        // Carregar achievements
        loadAchievements();
    });

    async function loadAchievements() {
        try {
            const response = await fetch('api/achievements/get.php');
            const data = await response.json();
            const unlockedIds = Object.keys(data.unlocked || {});

            const allBadges = [
                { id: "first_step", name: "Primeiro Passo", description: "Adicione seu primeiro anime", icon: "🚀", xp: 10 },
                { id: "explorer", name: "Explorador", description: "Adicione 3 animes", icon: "🧭", xp: 15 },
                { id: "collector", name: "Colecionador", description: "Tenha 5 animes na lista", icon: "📚", xp: 25 },
                { id: "started", name: "Começando", description: "Assista 10 episódios", icon: "▶️", xp: 15 },
                { id: "dedicated_viewer", name: "Espectador", description: "Assista 50 episódios", icon: "🎬", xp: 50 },
                { id: "centurion", name: "Centurião", description: "Assista 100 eps", icon: "💯", xp: 100 },
                { id: "finisher", name: "Finalizador", description: "Complete 1 anime", icon: "🎯", xp: 20 },
                { id: "first_love", name: "Primeiro Amor", description: "1 favorito", icon: "💕", xp: 10 },
                { id: "night_owl", name: "Coruja", description: "Use à noite", icon: "🦉", xp: 15 },
                { id: "theme_changer", name: "Estilista", description: "Mude o tema", icon: "🎨", xp: 10 }
            ];

            document.getElementById('achievements-summary').textContent =
                `${unlockedIds.length} de ${allBadges.length} conquistas`;

            document.getElementById('achievements-grid').innerHTML = allBadges.map(badge => {
                const isUnlocked = unlockedIds.includes(badge.id);
                return `
                <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                    <div class="achievement-icon">${badge.icon}</div>
                    <div class="achievement-info">
                        <div class="achievement-name">${badge.name}</div>
                        <div class="achievement-desc">${badge.description}</div>
                        <div class="achievement-xp">+${badge.xp} XP</div>
                    </div>
                    <div class="achievement-status">${isUnlocked ? '✅' : '🔒'}</div>
                </div>
            `;
            }).join('');
        } catch (e) {
            document.getElementById('achievements-grid').innerHTML = '<p>Erro</p>';
        }
    }

    // === SOCIAL FEATURES ===
    let isFollowing = false;

    // Carregar seguidores e status
    async function loadSocialData() {
        try {
            // Contar seguidores
            const countRes = await fetch(`api/users/comentarios.php?perfil_id=${profileUserId}`);

            // TODO: endpoint para contar seguidores
            // Por enquanto, apenas carregar comentários

        } catch (e) { console.error(e); }

        // Carregar comentários
        await loadComments();
    }

    // Check if following
    async function checkFollowStatus() {
        // Load and check follow status from API if needed
    }

    // Toggle follow
    async function toggleFollow() {
        const btn = document.getElementById('follow-btn');
        const action = isFollowing ? 'unfollow' : 'follow';

        try {
            const response = await fetch('api/users/seguir.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: profileUserId, action })
            });

            const result = await response.json();

            if (result.success) {
                isFollowing = !isFollowing;
                document.getElementById('followers-num').textContent = result.seguidores;

                if (isFollowing) {
                    btn.classList.add('following');
                    btn.innerHTML = '<i class="fas fa-user-check"></i> Seguindo';
                } else {
                    btn.classList.remove('following');
                    btn.innerHTML = '<i class="fas fa-user-plus"></i> Seguir';
                }
            }
        } catch (e) {
            console.error('Erro:', e);
        }
    }

    // Load comments
    async function loadComments() {
        try {
            const response = await fetch(`api/users/comentarios.php?perfil_id=${profileUserId}`);
            const comments = await response.json();

            const container = document.getElementById('comments-list');

            if (comments.length === 0) {
                container.innerHTML = '<p class="empty-message">Nenhum comentário ainda. Seja o primeiro!</p>';
            } else {
                container.innerHTML = comments.map(c => `
                <div class="comment-item">
                    <div class="comment-avatar">💬</div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author" onclick="window.location='perfil.php?user=${c.autor_username}'">${c.autor_username}</span>
                            <span class="comment-time">${formatTime(c.criado_em)}</span>
                        </div>
                        <div class="comment-text">${escapeHtml(c.conteudo)}</div>
                    </div>
                </div>
            `).join('');
            }
        } catch (e) {
            document.getElementById('comments-list').innerHTML = '<p>Erro ao carregar comentários</p>';
        }
    }

    // Submit comment
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const input = document.getElementById('comment-input');
            const conteudo = input.value.trim();

            if (!conteudo) return;

            try {
                const response = await fetch('api/users/comentarios.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ perfil_id: profileUserId, conteudo })
                });

                const result = await response.json();

                if (result.success) {
                    input.value = '';
                    await loadComments();
                } else {
                    alert(result.message || 'Erro ao adicionar comentário');
                }
            } catch (e) {
                console.error('Erro:', e);
            }
        });
    }

    // Helpers
    function formatTime(datetime) {
        const d = new Date(datetime);
        return d.toLocaleDateString('pt-BR');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Init social
    loadComments();
</script>

<?php
require_once 'includes/footer.php';
?>