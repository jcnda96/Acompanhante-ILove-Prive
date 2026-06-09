const axios = require('axios');
const admin = require('firebase-admin');
const { google } = require('googleapis');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const oauth2Client = new google.auth.OAuth2(
  process.env.BLOGGER_CLIENT_ID,
  process.env.BLOGGER_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.BLOGGER_REFRESH_TOKEN });
const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

const LOCALIDADES = [
  { cidade: "São Paulo",             estado: "SP", regiao: "São Paulo",          lat: -23.5505, lng: -46.6333 },
  { cidade: "Guarulhos",             estado: "SP", regiao: "Guarulhos",           lat: -23.4538, lng: -46.5333 },
  { cidade: "Campinas",              estado: "SP", regiao: "Campinas",            lat: -22.9083, lng: -47.0626 },
  { cidade: "São Bernardo do Campo", estado: "SP", regiao: "São Paulo",          lat: -23.6939, lng: -46.5650 },
  { cidade: "Santo André",           estado: "SP", regiao: "São Paulo",          lat: -23.6639, lng: -46.5383 },
  { cidade: "Rio de Janeiro",        estado: "RJ", regiao: "Rio de Janeiro",     lat: -22.9068, lng: -43.1729 },
  { cidade: "Niterói",               estado: "RJ", regiao: "Rio de Janeiro",     lat: -22.8838, lng: -43.1044 },
  { cidade: "Belo Horizonte",        estado: "MG", regiao: "Belo Horizonte",     lat: -19.9167, lng: -43.9345 },
  { cidade: "Uberlândia",            estado: "MG", regiao: "Belo Horizonte",     lat: -18.9186, lng: -48.2772 },
  { cidade: "Vitória",               estado: "ES", regiao: "Espírito Santo",     lat: -20.3155, lng: -40.3128 },
  { cidade: "Curitiba",              estado: "PR", regiao: "Curitiba",           lat: -25.4284, lng: -49.2733 },
  { cidade: "Londrina",              estado: "PR", regiao: "Curitiba",           lat: -23.3045, lng: -51.1696 },
  { cidade: "Porto Alegre",          estado: "RS", regiao: "Porto Alegre",       lat: -30.0346, lng: -51.2177 },
  { cidade: "Florianópolis",         estado: "SC", regiao: "Florianópolis",      lat: -27.5954, lng: -48.5480 },
  { cidade: "Balneário Camboriú",    estado: "SC", regiao: "Florianópolis",      lat: -26.9906, lng: -48.6348 },
  { cidade: "Brasília",              estado: "DF", regiao: "Brasília",           lat: -15.7801, lng: -47.9292 },
  { cidade: "Goiânia",               estado: "GO", regiao: "Goiânia",            lat: -16.6864, lng: -49.2643 },
  { cidade: "Cuiabá",                estado: "MT", regiao: "Mato Grosso",        lat: -15.5989, lng: -56.0949 },
  { cidade: "Campo Grande",          estado: "MS", regiao: "Mato Grosso do Sul", lat: -20.4697, lng: -54.6201 },
  { cidade: "Salvador",              estado: "BA", regiao: "Salvador",           lat: -12.9714, lng: -38.5014 },
  { cidade: "Recife",                estado: "PE", regiao: "Pernambuco",         lat:  -8.0476, lng: -34.8770 },
  { cidade: "Fortaleza",             estado: "CE", regiao: "Ceará",              lat:  -3.7172, lng: -38.5433 },
  { cidade: "Natal",                 estado: "RN", regiao: "Rio Grande do Norte",lat:  -5.7945, lng: -35.2110 },
  { cidade: "João Pessoa",           estado: "PB", regiao: "Paraíba",            lat:  -7.1195, lng: -34.8450 },
  { cidade: "Maceió",                estado: "AL", regiao: "Alagoas",            lat:  -9.6658, lng: -35.7350 },
  { cidade: "Aracaju",               estado: "SE", regiao: "Sergipe",            lat: -10.9472, lng: -37.0731 },
  { cidade: "Teresina",              estado: "PI", regiao: "Piauí",              lat:  -5.0892, lng: -42.8019 },
  { cidade: "São Luís",              estado: "MA", regiao: "Maranhão",           lat:  -2.5297, lng: -44.3028 },
  { cidade: "Belém",                 estado: "PA", regiao: "Pará",               lat:  -1.4558, lng: -48.4902 },
  { cidade: "Manaus",                estado: "AM", regiao: "Amazonas",           lat:  -3.1190, lng: -60.0217 },
  { cidade: "Porto Velho",           estado: "RO", regiao: "Rondônia",           lat:  -8.7612, lng: -63.9004 },
  { cidade: "Palmas",                estado: "TO", regiao: "Tocantins",          lat: -10.2491, lng: -48.3243 },
  { cidade: "Macapá",                estado: "AP", regiao: "Amapá",              lat:   0.0356, lng: -51.0705 },
  { cidade: "Rio Branco",            estado: "AC", regiao: "Acre",               lat:  -9.9754, lng: -67.8249 },
  { cidade: "Boa Vista",             estado: "RR", regiao: "Roraima",            lat:   2.8235, lng: -60.6758 }
];

// =====================================================
// GERADOR DE HTML PADRÃO — fonte única da verdade
// Todo post (novo, offline ou ressuscitado) passa por
// esta função, garantindo estrutura 100% consistente.
// =====================================================
function gerarHtml({ username, cidade, estado, avatar, badge, linkBtn, textoBtn, targetBtn, relBtn }) {
  const linkDireto = `https://iloveprive.com/${username}`;
  const rel = relBtn ? ` rel="${relBtn}"` : '';

  return `
          <div class="post-city">${cidade} - ${estado}</div>

          <div class="image-wrapper">
            <a href="${linkDireto}" target="_blank">
              <img src="${avatar}" alt="Acompanhante ${username}" class="avatar-img" />
            </a>
            <div class="blur-warning">🔞 Clique para Ver</div>
          </div>

          <div class="age-warning-banner">
            🔞 Conteúdo Sensível - Apenas Maiores de 18 Anos
          </div>

          ${badge}

          <table class="info-table">
            <tbody>
              <tr><th>Disponibilidade:</th><td>Chamada de Vídeo / Virtual</td></tr>
              <tr><th>Atendimento:</th><td>Imediato - Câmera Ligada</td></tr>
              <tr><th>Características:</th><td>Linda e Disponível</td></tr>
              <tr><th>Sigilo:</th><td>100% Anônimo e Seguro</td></tr>
            </tbody>
          </table>

          <div class="seo-desc">
            Procurando por <strong>photo acompanhante</strong> ou perfil estilo <strong>fatal model</strong> em <strong>${cidade} (${estado})</strong>? Conecte-se agora com <a href="${linkDireto}" target="_blank"><strong>${username}</strong></a>. Atendimento exclusivo via <strong>câmera privê</strong> com total sigilo. Para ver o nosso catálogo completo, acesse a página oficial do <a href="https://iloveprive.com" target="_blank">I'Love Prive</a>.
          </div>

          <a href="${linkBtn}" class="btn-call" target="${targetBtn}"${rel}>${textoBtn}</a>

          <div class="similar-models">
            <span class="similar-title">📍 Veja mais garotas nesta região:</span>
            <div class="similar-links">
              <a href="/search/label/${estado}">👉 Ver todas em ${estado}</a>
              <a href="/search/label/${cidade}">👉 Garotas em ${cidade}</a>
            </div>
          </div>
        `;
}

const badgeOnline  = '<div class="status-online"><span class="status-dot"></span> TRANSMITINDO AO VIVO</div>';
const badgeOffline = '<div class="status-offline">🌑 ATUALMENTE OFFLINE</div>';

function buildLabels(cidade, regiao, estado) {
  const raw = [cidade, regiao, estado];
  return Array.from(new Set(
    raw.filter(l => l && l.trim() !== '').map(l => l.trim())
  )).filter((label, _, arr) => {
    const low = label.toLowerCase();
    return arr.findIndex(l => l.toLowerCase() === low) === arr.indexOf(label);
  });
}

async function runBot() {
  try {
    console.log("Iniciando busca de modelos Brasileiras...");

    const response = await axios.get(
      `https://go.mavrtracktor.com/api/models?modelsCountry=br&limit=100&userId=${process.env.STRIPCASH_USER_ID}`,
      { timeout: 15000 }
    );
    const models = response.data.models;

    if (!models || models.length === 0) {
      console.log("Nenhuma modelo online. Abortando para não gerar falso offline.");
      return;
    }

    const onlineUsernames = models.map(m => m.username);
    // Mapa para recuperar avatarUrl de quem está online agora
    const onlineMap = Object.fromEntries(models.map(m => [m.username, m]));

    const ativasSnapshot = await db.collection('modelos_ativas')
      .where('postId', '!=', null)
      .get();

    // =======================================================
    // 1. ROTINA DE LIMPEZA (COLOCAR OFFLINE)
    // =======================================================
    for (const doc of ativasSnapshot.docs) {
      const data = doc.data();

      if (!onlineUsernames.includes(data.username)) {
        console.log(`[OFFLINE] ${data.username} saiu. Reconstruindo post no padrão atual...`);
        try {
          const hrefOffline = data.estado ? `/search/label/${data.estado}` : '/';
          const avatarUrl   = data.avatarUrl || 'https://via.placeholder.com/300';

          const htmlNovo = gerarHtml({
            username:  data.username,
            cidade:    data.cidade,
            estado:    data.estado,
            avatar:    avatarUrl,
            badge:     badgeOffline,
            linkBtn:   hrefOffline,
            textoBtn:  'Ver Outras Garotas Disponíveis',
            targetBtn: '_self',
            relBtn:    'nofollow'
          });

          // Recupera o título limpo do post atual (para não depender do que está no Firebase)
          const postAtual = await blogger.posts.get({ blogId: process.env.BLOG_ID, postId: data.postId });
          const tituloLimpo = postAtual.data.title.replace('[OFFLINE] ', '');

          await blogger.posts.patch({
            blogId: process.env.BLOG_ID,
            postId: data.postId,
            requestBody: { title: tituloLimpo, content: htmlNovo }
          });

          await db.collection('modelos_offline').doc(data.username).set({
            ...data,
            avatarUrl: avatarUrl,
            offlineDesde: admin.firestore.FieldValue.serverTimestamp()
          });
          await db.collection('modelos_ativas').doc(data.username).delete();

          console.log(`  ✅ Post de ${data.username} reconstruído e colocado offline.`);

        } catch (err) {
          console.error(`Erro ao colocar ${data.username} offline:`, err.message);
        }
      }
    }

    // =======================================================
    // 2. ROTINA DE POSTAGEM (CRIAR NOVAS OU RESSUSCITAR)
    // =======================================================
    console.log(`Encontradas ${models.length} modelos online na API Stripcash.`);
    const ativasUsernamesArray = ativasSnapshot.docs.map(doc => doc.data().username);
    let operacoesBlogger = 0;

    for (const model of models) {
      if (ativasUsernamesArray.includes(model.username)) continue;

      if (operacoesBlogger >= 3) {
        console.log("Limite de 3 operações por ciclo atingido. As próximas ficam para a próxima rodada.");
        break;
      }

      const docRefAtiva   = db.collection('modelos_ativas').doc(model.username);
      const docRefOffline = db.collection('modelos_offline').doc(model.username);
      const docOffline    = await docRefOffline.get();

      if (docOffline.exists) {
        // RESSURREIÇÃO: estava offline e voltou!
        const dataOffline = docOffline.data();
        console.log(`[VOLTOU] ${model.username} voltou online! Reconstruindo post no padrão atual...`);

        try {
          const linkDireto  = `https://iloveprive.com/${model.username}`;
          const avatarUrl   = model.avatarUrl || dataOffline.avatarUrl || 'https://via.placeholder.com/300';

          const htmlNovo = gerarHtml({
            username:  model.username,
            cidade:    dataOffline.cidade,
            estado:    dataOffline.estado,
            avatar:    avatarUrl,
            badge:     badgeOnline,
            linkBtn:   linkDireto,
            textoBtn:  'Entrar no Privê Agora',
            targetBtn: '_blank',
            relBtn:    null
          });

          const postAtual = await blogger.posts.get({ blogId: process.env.BLOG_ID, postId: dataOffline.postId });
          const tituloLimpo = postAtual.data.title.replace('[OFFLINE] ', '');

          await blogger.posts.patch({
            blogId: process.env.BLOG_ID,
            postId: dataOffline.postId,
            requestBody: { title: tituloLimpo, content: htmlNovo }
          });

          await docRefAtiva.set({
            ...dataOffline,
            avatarUrl: avatarUrl,
            dataPublicacao: admin.firestore.FieldValue.serverTimestamp()
          });
          await docRefOffline.delete();

          console.log(`  ✅ Post de ${model.username} reconstruído e colocado online.`);

        } catch (err) {
          console.error(`Erro ao ressuscitar ${model.username}:`, err.message);
        }

      } else {
        // MODELO INÉDITA: cria post do zero
        const localSorteado = LOCALIDADES[Math.floor(Math.random() * LOCALIDADES.length)];
        const titulo    = `Photo Acompanhante ${model.username} - Garota com Local em ${localSorteado.cidade} ${localSorteado.estado}`;
        const avatarUrl = model.avatarUrl || 'https://via.placeholder.com/300';
        const linkDireto = `https://iloveprive.com/${model.username}`;

        const htmlContent = gerarHtml({
          username:  model.username,
          cidade:    localSorteado.cidade,
          estado:    localSorteado.estado,
          avatar:    avatarUrl,
          badge:     badgeOnline,
          linkBtn:   linkDireto,
          textoBtn:  'Entrar no Privê Agora',
          targetBtn: '_blank',
          relBtn:    null
        });

        console.log(`Criando: ${model.username} em ${localSorteado.cidade}-${localSorteado.estado}`);

        const post = await blogger.posts.insert({
          blogId: process.env.BLOG_ID,
          isDraft: false,
          requestBody: {
            title:   titulo,
            content: htmlContent,
            labels:  buildLabels(localSorteado.cidade, localSorteado.regiao, localSorteado.estado),
            location: {
              name: `${localSorteado.cidade}, ${localSorteado.estado}, Brasil`,
              lat:  localSorteado.lat,
              lng:  localSorteado.lng,
              span: '0.1 0.1'
            }
          }
        });

        await docRefAtiva.set({
          username:  model.username,
          cidade:    localSorteado.cidade,
          estado:    localSorteado.estado,
          avatarUrl: avatarUrl,
          postId:    post.data.id,
          dataPublicacao: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[SUCESSO] Post criado: ${post.data.id}`);
      }

      operacoesBlogger++;
    }

    console.log("Rotina Executada com Sucesso Absoluto!");
  } catch (error) {
    console.error("Erro crítico:", error.message, error.stack);
  } finally {
    process.exit(0);
  }
}

runBot();
