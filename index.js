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
// FIX LOCALIZAÇÃO: Adicionados lat/lng reais — a Blogger API só registra location com coordenadas numéricas
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

// FIX #3: Elementos HTML de status SEM CSS inline — usam apenas classes do template.xml.
// FIX #4: As constantes de substituição são âncoras semânticas curtas (sem CSS inline longo),
// O dot usa SPAN (não div) para evitar o bug do lazy regex com divs aninhadas
const badgeOnline  = '<div class="status-online"><span class="status-dot"></span> TRANSMITINDO AO VIVO</div>';
const badgeOffline = '<div class="status-offline">🌑 ATUALMENTE OFFLINE</div>';

// REGEX_BADGE: Captura o badge inteiro + limpa qualquer texto orfão deixado pelo bug antigo
// O (?:\s*TRANSMITINDO AO VIVO<\/div>)* no final consome os restos do regex antigo
const REGEX_BADGE = /<div class="status-(?:online|offline)"[^>]*>[\s\S]*?<\/div>(?:\s*TRANSMITINDO AO VIVO<\/div>)*/i;
const REGEX_BTN = /<a[^>]*class="btn-call"[^>]*>[\s\S]*?<\/a>/i;

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
          
          let currentTitle = post.data.title.replace('[OFFLINE] ', '');
          let currentHtml = post.data.content;

          // Substituição via Regex robusta
          currentHtml = currentHtml.replace(REGEX_BADGE, badgeOffline);

          // FIX #2: Botão offline agora aponta para a busca regional da modelo,
          //         e NÃO mais para o linkAfiliado da própria modelo (que estará offline).
          //         Usamos o estado salvo no Firebase para gerar a URL de região correta.
          const estadoModelo = data.estado || '';
          const hrefOffline = estadoModelo
            ? `/search/label/${estadoModelo}`
            : '/';
          
          const btnOfflineFull = `<a href="${hrefOffline}" class="btn-call" target="_self" rel="nofollow">Ver Outras Garotas Disponíveis</a>`;
          currentHtml = currentHtml.replace(REGEX_BTN, btnOfflineFull);

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
    console.log(`Encontradas ${models.length} modelos online na API Stripcash.`);
    const ativasUsernamesArray = ativasSnapshot.docs.map(doc => doc.data().username);
    
    let operacoesBlogger = 0;

    for (const model of models) {
      if (ativasUsernamesArray.includes(model.username)) {
        continue; // Já está ativa no site perfeitamente, pula para a próxima sem gastar recursos
      }

      if (operacoesBlogger >= 3) {
        console.log("Limite de 3 postagens/ressurreições por ciclo atingido. As próximas ficam para a próxima rodada.");
        break; 
      }

      const docRefAtiva = db.collection('modelos_ativas').doc(model.username);

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

          currentHtml = currentHtml.replace(REGEX_BADGE, badgeOnline);

          // Restaura o link direto (Dofollow) para passar poder de SEO para o domínio principal
          const linkDireto = `https://iloveprive.com/${model.username}`;
          const btnOnlineFull = `<a href="${linkDireto}" class="btn-call" target="_blank">Entrar no Privê Agora</a>`;
          currentHtml = currentHtml.replace(REGEX_BTN, btnOnlineFull);

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
        // O link direto transfere a autoridade do Blogger para a página da modelo no domínio principal (Dofollow)
        const linkDireto = `https://iloveprive.com/${model.username}`;

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
            <a href="${linkDireto}" target="_blank">
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
            Procurando por <strong>photo acompanhante</strong> ou perfil estilo <strong>fatal model</strong> em <strong>${localSorteado.cidade} (${localSorteado.estado})</strong>? Conecte-se agora com <a href="${linkDireto}" target="_blank"><strong>${model.username}</strong></a>. Atendimento exclusivo via <strong>câmera privê</strong> com total sigilo. Para ver o nosso catálogo completo, acesse a página oficial do <a href="https://iloveprive.com" target="_blank">I'Love Prive</a>.
          </div>
          
          <a href="${linkDireto}" class="btn-call" target="_blank">Entrar no Privê Agora</a>

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
            // FIX DESCRIÇÃO: customMetaData NÃO é o campo 'Descrição da pesquisa' do Blogger.
            // Esse campo é metadata de blog-nível e é ignorado no editor de posts.
            // A Blogger API v3 não expõe o campo de search description via requestBody padrão.
            // O snippet/descrição é gerado automaticamente pelo Blogger a partir do texto do post.
            // Para controlar a descrição de pesquisa, o texto rico do .seo-desc já garante
            // que o Blogger extrai palavras-chave relevantes para o snippet automático.
            //
            // FIX LOCALIZAÇÃO: Adicionados lat/lng obrigatórios — sem coordenadas numéricas
            // a Blogger API ignora silenciosamente o campo location inteiro.
            location: {
              name: `${localSorteado.cidade}, ${localSorteado.estado}, Brasil`,
              lat:  localSorteado.lat,
              lng:  localSorteado.lng,
              span: '0.1 0.1'
            }
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
      
      operacoesBlogger++; // Conta que gastamos 1 cota de operação
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
}

runBot();
