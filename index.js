const axios = require('axios');
const admin = require('firebase-admin');
const { google } = require('googleapis');

// 1. Puxando as Senhas do GitHub Secrets
const STRIPCASH_USER_ID = process.env.STRIPCASH_USER_ID;
const BLOG_ID = process.env.BLOG_ID;

// 2. Inicializando o Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// 3. Inicializando o Blogger (Google API)
const oauth2Client = new google.auth.OAuth2(
  process.env.BLOGGER_CLIENT_ID,
  process.env.BLOGGER_CLIENT_SECRET
);
oauth2Client.setCredentials({
  refresh_token: process.env.BLOGGER_REFRESH_TOKEN
});
const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

// 4. As Cidades Mais Ricas do Brasil para o SEO
const CIDADES = [
  'São Paulo SP', 'Guarulhos SP', 'Campinas SP', 'São Bernardo do Campo SP', 'Santo André SP', 'Osasco SP',
  'Rio de Janeiro RJ', 'Niterói RJ',
  'Curitiba PR', 'Balneário Camboriú SC', 'Florianópolis SC', 'Porto Alegre RS',
  'Belo Horizonte MG', 'Brasília DF', 'Goiânia GO'
];

async function run() {
  console.log('Iniciando o Bot iLovePrive SEO...');

  try {
    // Busca brasileiras online na Stripcash
    const response = await axios.get(`https://go.mavrtracktor.com/api/models?modelsCountry=br&userId=${STRIPCASH_USER_ID}`);
    const models = response.data.models;

    if (!models || models.length === 0) {
      console.log('Nenhuma modelo brasileira online agora.');
      return;
    }

    console.log(`Encontradas ${models.length} brasileiras. Processando 3 postagens para não dar Spam...`);
    
    // Pegamos apenas as 3 primeiras para postar aos poucos (Drip-feed de SEO)
    const lote = models.slice(0, 3);

    for (const model of lote) {
      const username = model.username;
      
      // Verifica no Firebase se já postamos essa modelo antes
      const docRef = db.collection('modelos_ativas').doc(username);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        console.log(`[PULOU] A modelo ${username} já tem página no blog.`);
        continue; // Pula para a próxima garota
      }

      // Se é uma modelo nova, vamos criar o post!
      const cidadeSorteada = CIDADES[Math.floor(Math.random() * CIDADES.length)];
      
      // Foto Segura (SFW)
      const fotoCapa = model.avatarUrl || model.previewUrlThumbSmall;
      
      // Traduz e formata os atributos para a tabela HTML
      let atributos = 'Linda e Disponível';
      if (model.tags && model.tags.length > 0) {
        atributos = model.tags.join(', ').replace(/girls\//g, '').replace(/-/g, ' ');
      }

      // Monta o Link de Redirecionamento Direto para o seu Whitelabel
      const linkSala = `https://go.mavrtracktor.com/api/goToTheRoom?modelsList=${username}&userId=${STRIPCASH_USER_ID}&targetDomain=iloveprive.com`;

      // Monta o Código HTML da Postagem
      const htmlPost = `
        <div class="post-city">${cidadeSorteada} - Ao Vivo Agora</div>
        <img src="${fotoCapa}" alt="Foto de ${username}, acompanhante virtual em ${cidadeSorteada}" class="avatar-img" />
        
        <div class="status-online">
          <div class="status-dot"></div> ONLINE NO PRIVÊ
        </div>
        
        <table class="info-table">
          <tbody>
            <tr><th>Disponibilidade:</th><td>Chamada de Vídeo / Virtual</td></tr>
            <tr><th>Atendimento:</th><td>Imediato - Câmera Ligada</td></tr>
            <tr><th>Características:</th><td style="text-transform: capitalize;">${atributos}</td></tr>
            <tr><th>Sigilo:</th><td>100% Anônimo e Seguro</td></tr>
          </tbody>
        </table>
        
        <div class="seo-desc">
          Olá, eu sou a *${username}*. Se você está em *${cidadeSorteada}* ou região procurando uma garota com local para algo discreto e real, me chame agora. O atendimento é online, no estilo OnlyFans e Privacy. Esqueça mensagens sem resposta no Photo Acompanhante e Fatal Model. Vem pra minha sala que a gente se vê na câmera agora mesmo.
        </div>
        
        <a href="${linkSala}" class="btn-call" target="_blank" rel="nofollow">
          ENTRAR NA CHAMADA AGORA
        </a>
      `;

      // Envia para o Blogger
      const postagem = await blogger.posts.insert({
        blogId: BLOG_ID,
        isDraft: false,
        requestBody: {
          title: `${username} - Garota com Local e Chamada Privê em ${cidadeSorteada}`,
          content: htmlPost,
          labels: ['Acompanhante', 'Fatal Model', 'Privacy', cidadeSorteada.split(' ')[0]] // Tags de SEO
        }
      });

      console.log(`[SUCESSO] Post criado: ${username} em ${cidadeSorteada}`);

      // Salva no Firebase para o robô lembrar que já postou
      await docRef.set({
        username: username,
        cidade: cidadeSorteada,
        postId: postagem.data.id,
        url: postagem.data.url,
        criadaEm: admin.firestore.FieldValue.serverTimestamp()
      });

      // Pausa de 3 segundos entre as postagens para o Google não achar que é ataque
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('Rotina finalizada com sucesso!');
  } catch (error) {
    console.error('Erro geral no robô:', error.message);
  }
}

run();
