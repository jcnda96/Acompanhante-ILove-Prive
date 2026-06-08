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
  { cidade: "Teresina", index: "PI", regiao: "Piauí" },
  { cidade: "São Luís", estado: "MA", regiao: "Maranhão" },
  { cidade: "Belém", estado: "PA", regiao: "Pará" },
  { cidade: "Manaus", estado: "AM", regiao: "Amazonas" },
  { cidade: "Porto Velho", estado: "RO", regiao: "Rondônia" },
  { cidade: "Palmas", estado: "TO", regiao: "Tocantins" },
  { cidade: "Macapá", estado: "AP", regiao: "Amapá" },
  { cidade: "Rio Branco", estado: "AC", regiao: "Acre" },
  { cidade: "Boa Vista", estado: "RR", regiao: "Roraima" }
];

// ELEMENTOS HTML PARA ALTERAÇÃO DE STATUS
const badgeOnline = '<div class="status-online"><div class="status-dot"></div> TRANSMITINDO AO VIVO</div>';
const badgeOffline = '<div class="status-offline" style="background: rgba(161, 161, 170, 0.1); color: #a1a1aa; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 20px; border: 1px solid rgba(161, 161, 170, 0.25); width: max-content; margin-left: auto; margin-right: auto;">🌑 ATUALMENTE OFFLINE</div>';
const btnOnline = '>Entrar no Privê Agora</a>';
const btnOffline = '>Ver Outras Garotas Disponíveis</a>';

async function runBot() {
  try {
    console.log("Iniciando busca de modelos Brasileiras...");
    
    // Puxa as modelos online da Stripcash
    const response = await axios.get(`https://go.mavrtracktor.com/api/models?modelsCountry=br&limit=100&userId=${process.env.STRIPCASH_USER_ID}`);
    const models = response.data.models;
    
    if (!models || models.length === 0) {
      console.log("Nenhuma modelo online. Abortando para não gerar falso offline.");
      return;
    }

    const onlineUsernames = models.map(m => m.username);

    // =======================================================
    // 1. ROTINA DE LIMPEZA (COLOCAR OFFLINE)
    // =======================================================
    const ativasSnapshot = await db.collection('modelos_ativas').get();
    
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

          // Troca as tags HTML para cinza/offline
          currentHtml = currentHtml.replace(badgeOnline, badgeOffline);
          currentHtml = currentHtml.replace(btnOnline, btnOffline);

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

          // Troca as tags cinzas de volta para verde brilhante
          currentHtml = currentHtml.replace(badgeOffline, badgeOnline);
          currentHtml = currentHtml.replace(btnOffline, btnOnline);

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

        const htmlContent = `
          <div class="post-city">${localSorteado.cidade} - ${localSorteado.estado}</div>
          
          <div class="image-wrapper" style="position: relative; display: inline-block; width: 100%; text-align: center; margin-bottom: 15px;">
            <a href="${linkAfiliado}" target="_blank" rel="nofollow" style="display: block; position: relative;">
              <img src="${avatar}" alt="Acompanhante ${model.username}" class="avatar-img" style="filter: blur(12px); -webkit-filter: blur(12px); transform: scale(1.05);" />
            </a>
          </div>

          <div class="age-warning" style="background: rgba(225, 29, 72, 0.1); color: #e11d48; padding: 10px; text-align: center; font-size: 11px; font-weight: 800; border-radius: 8px; border: 1px solid rgba(225, 29, 72, 0.3); margin-bottom: 15px; text-transform: uppercase;">
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
          
          <a href="${linkAfiliado}" class="btn-call" target="_blank" rel="nofollow">
            >Entrar no Privê Agora</a>

          <div class="similar-models" style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #27272a;">
            <span style="font-size: 12px; color: #a1a1aa; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">📍 Veja mais garotas nesta região:</span><br/>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 15px;">
              <a href="/search/label/${localSorteado.estado}" style="background: #18181b; border: 1px solid #3f3f46; color: #e11d48; padding: 10px 18px; border-radius: 30px; font-size: 12px; font-weight: 800; text-decoration: none; transition: 0.3s;">
                👉 Ver todas em ${localSorteado.estado}
              </a>
              <a href="/search/label/${localSorteado.cidade}" style="background: #18181b; border: 1px solid #3f3f46; color: #e11d48; padding: 10px 18px; border-radius: 30px; font-size: 12px; font-weight: 800; text-decoration: none; transition: 0.3s;">
                👉 Garotas em ${localSorteado.cidade}
              </a>
            </div>
          </div>
        `;

        console.log(`Criando listagem Inédita: ${model.username} em ${localSorteado.cidade}-${localSorteado.estado}`);
        
        const tagsBlogger = Array.from(new Set([
          localSorteado.cidade, 
          localSorteado.regiao, 
          localSorteado.estado
        ]));

        const post = await blogger.posts.insert({
          blogId: process.env.BLOG_ID,
          isDraft: false,
          requestBody: {
            title: titulo,
            content: htmlContent,
            labels: tagsBlogger,
            customMetaData: descPesquisa, 
            location: { name: `${localSorteado.cidade}, ${localSorteado.estado}, Brasil` } 
          }
        });

        await docRefAtiva.set({
          username: model.username,
          cidade: localSorteado.cidade,
          estado: localSorteado.estado,
          postId: post.data.id,
          dataPublicacao: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[SUCESSO] Novo Post injetado com ID: ${post.data.id}`);
      }
    }
    console.log("Rotina Executada com Sucesso Absoluto!");
  } catch (error) {
    console.error("Erro crítico na execução do bot:", error.message);
  }
}

runBot();
