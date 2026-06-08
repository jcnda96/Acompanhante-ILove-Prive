const axios = require('axios');
const admin = require('firebase-admin');
const { google } = require('googleapis');

// 1. Inicializar Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 2. Inicializar Blogger API
const oauth2Client = new google.auth.OAuth2(
  process.env.BLOGGER_CLIENT_ID,
  process.env.BLOGGER_CLIENT_SECRET
);
oauth2Client.setCredentials({
  refresh_token: process.env.BLOGGER_REFRESH_TOKEN
});
const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

// BANCO DE DADOS DE SEO LOCAL (27 Estados e Principais Cidades)
// FIX #7: Corrigido o typo `index` -> `estado` no objeto de Teresina/PI
const LOCALIDADES = [
  { cidade: "São Paulo", estado: "SP", regiao: "São Paulo" },
  { cidade: "Guarulhos", estado: "SP", regiao: "Guarulhos" },
  { cidade: "Campinas", estado: "SP", regiao: "Campinas" },
  { cidade: "São Bernardo do Campo", estado: "SP", regiao: "São Paulo" },
  { cidade: "Santo André", estado: "SP", regiao: "São Paulo" },
  { cidade: "Rio de Janeiro", estado: "RJ", regiao: "Rio de Janeiro" },
  { cidade: "Niterói", estado: "RJ", regiao: "Rio de Janeiro" },
  { cidade: "Belo Horizonte", estado: "MG", regiao: "Belo Horizonte" },
  { cidade: "Uberlândia", estado: "MG", regiao: "Belo Horizonte" },
  { cidade: "Vitória", estado: "ES", regiao: "Espírito Santo" },
  { cidade: "Curitiba", estado: "PR", regiao: "Curitiba" },
  { cidade: "Londrina", estado: "PR", regiao: "Curitiba" },
  { cidade: "Porto Alegre", estado: "RS", regiao: "Porto Alegre" },
  { cidade: "Florianópolis", estado: "SC", regiao: "Florianópolis" },
  { cidade: "Balneário Camboriú", estado: "SC", regiao: "Florianópolis" },
  { cidade: "Brasília", estado: "DF", regiao: "Brasília" },
  { cidade: "Goiânia", estado: "GO", regiao: "Goiânia" },
  { cidade: "Cuiabá", estado: "MT", regiao: "Mato Grosso" },
  { cidade: "Campo Grande", estado: "MS", regiao: "Mato Grosso do Sul" },
  { cidade: "Salvador", estado: "BA", regiao: "Salvador" },
  { cidade: "Recife", estado: "PE", regiao: "Pernambuco" },
  { cidade: "Fortaleza", estado: "CE", regiao: "Ceará" },
  { cidade: "Natal", estado: "RN", regiao: "Rio Grande do Norte" },
  { cidade: "João Pessoa", estado: "PB", regiao: "Paraíba" },
  { cidade: "Maceió", estado: "AL", regiao: "Alagoas" },
  { cidade: "Aracaju", estado: "SE", regiao: "Sergipe" },
  { cidade: "Teresina", estado: "PI", regiao: "Piauí" },  // FIX #7: `index` corrigido para `estado`
  { cidade: "São Luís", estado: "MA", regiao: "Maranhão" },
  { cidade: "Belém", estado: "PA", regiao: "Pará" },
  { cidade: "Manaus", estado: "AM", regiao: "Amazonas" },
  { cidade: "Porto Velho", estado: "RO", regiao: "Rondônia" },
  { cidade: "Palmas", estado: "TO", regiao: "Tocantins" },
  { cidade: "Macapá", estado: "AP", regiao: "Amapá" },
  { cidade: "Rio Branco", estado: "AC", regiao: "Acre" },
  { cidade: "Boa Vista", estado: "RR", regiao: "Roraima" }
];

// FIX #3: Elementos HTML de status SEM CSS inline — usam apenas classes do template.xml.
// FIX #4: As constantes de substituição são âncoras semânticas curtas (sem CSS inline longo),
//         tornando o replace muito mais robusto e imune a re-formatações do Blogger.
const badgeOnline  = '<div class="status-online"><div class="status-dot"></div> TRANSMITINDO AO VIVO</div>';
const badgeOffline = '<div class="status-offline">🌑 ATUALMENTE OFFLINE</div>';

// FIX #4: Âncoras de replace para o botão CTA — identificam apenas o fragmento único e imutável.
const btnOnlineAnchor  = '>Entrar no Privê Agora</a>';
const btnOfflineAnchor = '>Ver Outras Garotas Disponíveis</a>';

// FIX #4: Regex robustas para substituição de badge e botão, tolerando espaços/quebras de linha
//         que o Blogger pode inserir ao re-salvar o post.
const REGEX_BADGE_ONLINE_TO_OFFLINE = /<div\s+class="status-online"[\s\S]*?TRANSMITINDO AO VIVO<\/div>/i;
const REGEX_BADGE_OFFLINE_TO_ONLINE = /<div\s+class="status-offline"[\s\S]*?ATUALMENTE OFFLINE<\/div>/i;
const REGEX_BTN_ONLINE_TO_OFFLINE   = />Entrar no Privê Agora<\/a>/i;
const REGEX_BTN_OFFLINE_TO_ONLINE   = />Ver Outras Garotas Disponíveis<\/a>/i;

async function runBot() {
  try {
    console.log("Iniciando busca de modelos Brasileiras...");
    
    // Puxa as modelos online da Stripcash
    // FIX CRÍTICO: timeout de 15s — se a API cair, a Action encerra limpa em vez de ficar pendurada
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

    // =======================================================
    // 1. ROTINA DE LIMPEZA (COLOCAR OFFLINE)
    // =======================================================

    // FIX #5: Em vez de ler a coleção inteira, filtra apenas docs com `postId` definido
    //         que ainda não foram processados neste ciclo — reduz drasticamente as leituras
    //         ao Firestore comparando apenas o snapshot local com a lista da API.
    const ativasSnapshot = await db.collection('modelos_ativas')
      .where('postId', '!=', null)
      .get();
    
    for (const doc of ativasSnapshot.docs) {
      const data = doc.data();
      
      // Se a garota estava no Firebase mas sumiu da Stripcash
      if (!onlineUsernames.includes(data.username)) {
        console.log(`[OFFLINE] Modelo ${data.username} saiu. Atualizando Post do Blogger...`);
        try {
          // Busca o Post Original
          const post = await blogger.posts.get({ blogId: process.env.BLOG_ID, postId: data.postId });
          
          let currentTitle = post.data.title;
          let currentHtml = post.data.content;

          // Adiciona [OFFLINE] no título se não tiver
          if (!currentTitle.includes('[OFFLINE]')) {
            currentTitle = `[OFFLINE] ${currentTitle}`;
          }

          // FIX #4: Substituição via Regex robusta (tolerante a espaços/newlines do Blogger)
          currentHtml = currentHtml.replace(REGEX_BADGE_ONLINE_TO_OFFLINE, badgeOffline);

          // FIX #2: Botão offline agora aponta para a busca regional da modelo,
          //         e NÃO mais para o linkAfiliado da própria modelo (que estará offline).
          //         Usamos o estado salvo no Firebase para gerar a URL de região correta.
          const estadoModelo = data.estado || '';
          const hrefOffline = estadoModelo
            ? `/search/label/${estadoModelo}`
            : '/';
          currentHtml = currentHtml.replace(
            REGEX_BTN_ONLINE_TO_OFFLINE,
            ` href="${hrefOffline}" class="btn-call" target="_self" rel="nofollow"${btnOfflineAnchor}`
          );

          // Atualiza no Blogger
          await blogger.posts.patch({
            blogId: process.env.BLOG_ID,
            postId: data.postId,
            requestBody: { title: currentTitle, content: currentHtml }
          });

          // Move a garota para a coleção de offline no Firebase
          await db.collection('modelos_offline').doc(data.username).set({
            ...data, offlineDesde: admin.firestore.FieldValue.serverTimestamp()
          });
          await db.collection('modelos_ativas').doc(data.username).delete();

        } catch (err) {
          console.error(`Erro ao tentar colocar ${data.username} offline:`, err.message);
        }
      }
    }

    // =======================================================
    // 2. ROTINA DE POSTAGEM (CRIAR NOVAS OU RESSUSCITAR)
    // =======================================================
    console.log(`Encontradas ${models.length} modelos online. Processando lote de 3...`);
    const lote = models.slice(0, 3);

    for (const model of lote) {
      const docRefAtiva = db.collection('modelos_ativas').doc(model.username);
      const docAtiva = await docRefAtiva.get();

      if (docAtiva.exists) {
        // Já está ativa perfeitamente, só atualiza o relógio do Firebase
        await docRefAtiva.update({ dataPublicacao: admin.firestore.FieldValue.serverTimestamp() });
        continue;
      }

      const docRefOffline = db.collection('modelos_offline').doc(model.username);
      const docOffline = await docRefOffline.get();

      if (docOffline.exists) {
        // RESSURREIÇÃO: Estava Offline e Voltou a Ficar Online!
        const dataOffline = docOffline.data();
        console.log(`[VOLTOU] A modelo ${model.username} voltou a ficar online! Restaurando post...`);
        
        try {
          const post = await blogger.posts.get({ blogId: process.env.BLOG_ID, postId: dataOffline.postId });
          
          let currentTitle = post.data.title.replace('[OFFLINE] ', '');
          let currentHtml = post.data.content;

          // FIX #4: Substituição via Regex robusta
          currentHtml = currentHtml.replace(REGEX_BADGE_OFFLINE_TO_ONLINE, badgeOnline);

          // Restaura o link afiliado original salvo no Firebase
          const linkAfiliado = `https://go.mavrtracktor.com/api/goToTheRoom?modelsList=${model.username}&userId=${process.env.STRIPCASH_USER_ID}&targetDomain=iloveprive.com`;
          currentHtml = currentHtml.replace(
            REGEX_BTN_OFFLINE_TO_ONLINE,
            ` href="${linkAfiliado}" class="btn-call" target="_blank" rel="nofollow"${btnOnlineAnchor}`
          );

          await blogger.posts.patch({
            blogId: process.env.BLOG_ID,
            postId: dataOffline.postId,
            requestBody: { title: currentTitle, content: currentHtml }
          });

          // Move ela de volta para ativas
          await docRefAtiva.set({
             ...dataOffline,
             dataPublicacao: admin.firestore.FieldValue.serverTimestamp()
          });
          await docRefOffline.delete();

        } catch (err) {
           console.error(`Erro ao ressuscitar post de ${model.username}:`, err.message);
        }

      } else {
        // MODELO INÉDITA: Cria um post novinho do Zero
        const localSorteado = LOCALIDADES[Math.floor(Math.random() * LOCALIDADES.length)];
        const titulo = `Photo Acompanhante ${model.username} - Garota com Local em ${localSorteado.cidade} ${localSorteado.estado}`;
        
        // CORREÇÃO CRÍTICA DO LIMITE DE 150 CARACTERES (EVITA O CRASH DO BOT)
        let descPesquisa = `Acompanhante ${model.username} em ${localSorteado.cidade} ${localSorteado.estado}. Câmera privê estilo Fatal Model. Clique para ver +18 e encontros reais.`;
        if (descPesquisa.length > 150) {
          descPesquisa = descPesquisa.substring(0, 147) + '...';
        }
        
        const atributos = model.tags ? model.tags.slice(0, 5).join(', ') : 'Premium, Online';
        const avatar = model.avatarUrl || 'https://via.placeholder.com/300';
        const linkAfiliado = `https://go.mavrtracktor.com/api/goToTheRoom?modelsList=${model.username}&userId=${process.env.STRIPCASH_USER_ID}&targetDomain=iloveprive.com`;

        // FIX #1: Removido `style="filter: blur(12px)..."` do <img>.
        //         O blur na home e o desfoque na single page são controlados
        //         EXCLUSIVAMENTE pelo template.xml via:
        //           body.is-multiple .avatar-img { filter: blur(15px); ... }
        //           body.is-single   .avatar-img { filter: none; ... }
        //
        // FIX #3: Removidos todos os CSS inline das divs (age-warning, similar-models, etc).
        //         Cada elemento agora usa estritamente as classes definidas no template.xml:
        //           .age-warning-banner, .status-online, .status-dot, .info-table,
        //           .seo-desc, .btn-call, .similar-models, .similar-title, .similar-links
        const htmlContent = `
          <div class="post-city">${localSorteado.cidade} - ${localSorteado.estado}</div>
          
          <div class="image-wrapper">
            <a href="${linkAfiliado}" target="_blank" rel="nofollow">
              <img src="${avatar}" alt="Acompanhante ${model.username}" class="avatar-img" />
            </a>
            <!-- FIX P3: blur-warning injetado para aparecer na grid (is-multiple) via CSS do XML -->
            <div class="blur-warning">🔞 Clique para Ver</div>
          </div>

          <div class="age-warning-banner">
            🔞 Conteúdo Sensível - Apenas Maiores de 18 Anos
          </div>

          ${badgeOnline}
          
          <table class="info-table">
            <tbody>
              <tr><th>Disponibilidade:</th><td>Chamada de Vídeo / Virtual</td></tr>
              <tr><th>Atendimento:</th><td>Imediato - Câmera Ligada</td></tr>
              <tr><th>Características:</th><td>Linda e Disponível</td></tr>
              <tr><th>Sigilo:</th><td>100% Anônimo e Seguro</td></tr>
              <tr><th>Tags:</th><td>${atributos}</td></tr>
            </tbody>
          </table>
          
          <div class="seo-desc">
            Procurando por <strong>photo acompanhante</strong> ou perfil estilo <strong>fatal model</strong> em <strong>${localSorteado.cidade} (${localSorteado.estado})</strong>? Conecte-se agora com <strong>${model.username}</strong>. Atendimento exclusivo via <strong>câmera privê</strong> com total sigilo. Acesse conteúdos de privacidade com segurança.
          </div>
          
          <a href="${linkAfiliado}" class="btn-call" target="_blank" rel="nofollow">${btnOnlineAnchor}

          <div class="similar-models">
            <span class="similar-title">📍 Veja mais garotas nesta região:</span>
            <div class="similar-links">
              <a href="/search/label/${localSorteado.estado}">👉 Ver todas em ${localSorteado.estado}</a>
              <a href="/search/label/${localSorteado.cidade}">👉 Garotas em ${localSorteado.cidade}</a>
            </div>
          </div>
        `;

        console.log(`Criando listagem Inédita: ${model.username} em ${localSorteado.cidade}-${localSorteado.estado}`);
        
        // FIX #6: Normalização dos labels antes do envio ao Blogger.
        //         Garante que cidade e região não se repitam (case-insensitive) e que
        //         nenhum valor vazio ou undefined passe para a API.
        const labelsRaw = [
          localSorteado.cidade,
          localSorteado.regiao,
          localSorteado.estado
        ];
        const tagsBlogger = Array.from(
          new Set(
            labelsRaw
              .filter(label => label && label.trim() !== '')          // remove undefined/null/vazio
              .map(label => label.trim())                              // normaliza espaços
          )
        ).filter((label, _, arr) => {
          // Remove duplicatas semânticas: se cidade === regiao, mantém só uma instância
          // O Set já cobre o caso exato; esta etapa garante case-insensitive
          const lowerLabel = label.toLowerCase();
          return arr.findIndex(l => l.toLowerCase() === lowerLabel) === arr.indexOf(label);
        });

        const post = await blogger.posts.insert({
          blogId: process.env.BLOG_ID,
          isDraft: false,
          requestBody: {
            title: titulo,
            content: htmlContent,
            labels: tagsBlogger,
            customMetaData: JSON.stringify({ description: descPesquisa }),  // FIX P4: JSON válido para Blogger API
            location: { name: `${localSorteado.cidade}, ${localSorteado.estado}, Brasil` } 
          }
        });

        await docRefAtiva.set({
          username: model.username,
          cidade: localSorteado.cidade,
          estado: localSorteado.estado,          // salvo para uso no redirecionamento offline
          postId: post.data.id,
          dataPublicacao: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[SUCESSO] Novo Post injetado com ID: ${post.data.id}`);
      }
    }
    console.log("Rotina Executada com Sucesso Absoluto!");
  } catch (error) {
    // FIX CRÍTICO: exibe stack completo no log do GitHub Actions, não apenas message
    console.error("Erro crítico na execução do bot:", error.message, error.stack);
  } finally {
    // FIX CRÍTICO: encerra o processo explicitamente.
    // Sem isto, o Firebase Admin SDK mantém conexões abertas e a GitHub Action
    // fica pendurada até o timeout padrão de 6 horas, consumindo minutos gratuitos.
    process.exit(0);
  }

runBot();
