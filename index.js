const axios = require('axios');
const admin = require('firebase-admin');
const { google } = require('googleapis');

// 1. Inicializar Firebase (Usando as chaves do GitHub Secrets)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 2. Inicializar Blogger API (Com o Refresh Token)
const oauth2Client = new google.auth.OAuth2(
  process.env.BLOGGER_CLIENT_ID,
  process.env.BLOGGER_CLIENT_SECRET
);
oauth2Client.setCredentials({
  refresh_token: process.env.BLOGGER_REFRESH_TOKEN
});
const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

// BANCO DE DADOS DE SEO LOCAL - TODOS OS ESTADOS BRASILEIROS (Foco nas principais hubs)
const LOCALIDADES = [
  // Sudeste
  { cidade: "São Paulo", estado: "SP", regiao: "São Paulo" },
  { cidade: "Guarulhos", estado: "SP", regiao: "Guarulhos" },
  { cidade: "Campinas", estado: "SP", regiao: "Campinas" },
  { cidade: "São Bernardo do Campo", estado: "SP", regiao: "São Paulo" },
  { cidade: "Santo André", estado: "SP", regiao: "São Paulo" },
  { cidade: "Osasco", estado: "SP", regiao: "São Paulo" },
  { cidade: "Ribeirão Preto", estado: "SP", regiao: "São Paulo" },
  { cidade: "Sorocaba", estado: "SP", regiao: "São Paulo" },
  { cidade: "Santos", estado: "SP", regiao: "São Paulo" },
  { cidade: "Rio de Janeiro", estado: "RJ", regiao: "Rio de Janeiro" },
  { cidade: "Niterói", estado: "RJ", regiao: "Rio de Janeiro" },
  { cidade: "Duque de Caxias", estado: "RJ", regiao: "Rio de Janeiro" },
  { cidade: "Belo Horizonte", estado: "MG", regiao: "Belo Horizonte" },
  { cidade: "Uberlândia", estado: "MG", regiao: "Belo Horizonte" },
  { cidade: "Contagem", estado: "MG", regiao: "Belo Horizonte" },
  { cidade: "Vitória", estado: "ES", regiao: "Espírito Santo" },
  { cidade: "Vila Velha", estado: "ES", regiao: "Espírito Santo" },
  
  // Sul
  { cidade: "Curitiba", estado: "PR", regiao: "Curitiba" },
  { cidade: "Londrina", estado: "PR", regiao: "Curitiba" },
  { cidade: "Maringá", estado: "PR", regiao: "Curitiba" },
  { cidade: "Porto Alegre", estado: "RS", regiao: "Porto Alegre" },
  { cidade: "Caxias do Sul", estado: "RS", regiao: "Porto Alegre" },
  { cidade: "Florianópolis", estado: "SC", regiao: "Florianópolis" },
  { cidade: "Joinville", estado: "SC", regiao: "Florianópolis" },
  { cidade: "Balneário Camboriú", estado: "SC", regiao: "Florianópolis" },
  
  // Centro-Oeste
  { cidade: "Brasília", estado: "DF", regiao: "Brasília" },
  { cidade: "Goiânia", estado: "GO", regiao: "Goiânia" },
  { cidade: "Aparecida de Goiânia", estado: "GO", regiao: "Goiânia" },
  { cidade: "Cuiabá", estado: "MT", regiao: "Mato Grosso" },
  { cidade: "Campo Grande", estado: "MS", regiao: "Mato Grosso do Sul" },
  
  // Nordeste
  { cidade: "Salvador", estado: "BA", regiao: "Salvador" },
  { cidade: "Feira de Santana", estado: "BA", regiao: "Salvador" },
  { cidade: "Recife", estado: "PE", regiao: "Pernambuco" },
  { cidade: "Jaboatão dos Guararapes", estado: "PE", regiao: "Pernambuco" },
  { cidade: "Fortaleza", estado: "CE", regiao: "Ceará" },
  { cidade: "Natal", estado: "RN", regiao: "Rio Grande do Norte" },
  { cidade: "João Pessoa", estado: "PB", regiao: "Paraíba" },
  { cidade: "Maceió", estado: "AL", regiao: "Alagoas" },
  { cidade: "Aracaju", estado: "SE", regiao: "Sergipe" },
  { cidade: "Teresina", estado: "PI", regiao: "Piauí" },
  { cidade: "São Luís", estado: "MA", regiao: "Maranhão" },
  
  // Norte
  { cidade: "Belém", estado: "PA", regiao: "Pará" },
  { cidade: "Manaus", estado: "AM", regiao: "Amazonas" },
  { cidade: "Porto Velho", estado: "RO", regiao: "Rondônia" },
  { cidade: "Palmas", estado: "TO", regiao: "Tocantins" },
  { cidade: "Macapá", estado: "AP", regiao: "Amapá" },
  { cidade: "Rio Branco", estado: "AC", regiao: "Acre" },
  { cidade: "Boa Vista", estado: "RR", regiao: "Roraima" }
];

async function runBot() {
  try {
    console.log("Iniciando busca de modelos Brasileiras...");
    
    // Puxa as modelos online da Stripcash com geolocalização BR
    const response = await axios.get(`https://go.mavrtracktor.com/api/models?modelsCountry=br&limit=100&userId=${process.env.STRIPCASH_USER_ID}`);
    const models = response.data.models;
    
    if (!models || models.length === 0) {
      console.log("Nenhuma modelo online encontrada no momento.");
      return;
    }

    console.log(`Encontradas ${models.length} modelos. Processando lote de 3 listagens para sincronização perfeita com a paginação...`);
    const lote = models.slice(0, 3); // Lote de 3 em 3 para o loop infinito funcionar perfeitamente

    for (const model of lote) {
      const docRef = db.collection('modelos_ativas').doc(model.username);
      const doc = await docRef.get();

      if (!doc.exists) {
        // Modelo nova: Sorteia uma das localidades estratégicas do Brasil
        const localSorteado = LOCALIDADES[Math.floor(Math.random() * LOCALIDADES.length)];
        
        // Estrutura de Títulos focada em Cauda Longa (SEO Extremo)
        const titulo = `Photo Acompanhante ${model.username} - Garota com Local em ${localSorteado.cidade} ${localSorteado.estado}`;
        
        const atributos = model.tags ? model.tags.slice(0, 5).join(', ') : 'Premium, Online';
        const avatar = model.avatarUrl || 'https://via.placeholder.com/300';

        // HTML Injetado Otimizado para a Estrutura Semântica do tema_v2.xml
        const htmlContent = `
          <div class="post-city">${localSorteado.cidade} - ${localSorteado.estado}</div>
          <img src="${avatar}" alt="Photo Acompanhante ${model.username} no Fatal Model" class="avatar-img" />
          <div class="status-online"><div class="status-dot"></div> TRANSMITINDO AO VIVO</div>
          
          <table class="info-table">
            <tbody>
              <tr><th>Plataforma VIP:</th><td>Privacy / OnlyFans</td></tr>
              <tr><th>Atendimento:</th><td>Câmera Privê Imediata</td></tr>
              <tr><th>Tags Relacionadas:</th><td>${atributos}</td></tr>
              <tr><th>Acesso Seguro:</th><td>Verificado Antifraude</td></tr>
            </tbody>
          </table>
          
          <div class="seo-desc">
            Procurando por <strong>photo acompanhante</strong> ou perfil estilo <strong>fatal model</strong> em <strong>${localSorteado.cidade} (${localSorteado.estado})</strong>? Conecte-se agora com <strong>${model.username}</strong>. Atendimento exclusivo via <strong>câmera privê</strong> com total sigilo. Acesse conteúdos estilo <strong>onlyfans</strong> e <strong>privacy</strong> com segurança e sem intermediários na plataforma oficial do I'Love Prive.
          </div>
          
          <a href="https://go.mavrtracktor.com/api/goToTheRoom?modelsList=${model.username}&userId=${process.env.STRIPCASH_USER_ID}&targetDomain=iloveprive.com" class="btn-call" target="_blank" rel="nofollow">
            Entrar no Privê Agora
          </a>
        `;

        console.log(`Criando listagem otimizada para SEO: ${model.username} em ${localSorteado.cidade}-${localSorteado.estado}`);
        
        // MÁGICA DO FILTRO: Vincula as etiquetas exatas do carrossel de Stories do Blogger
        const tagsBlogger = [
          localSorteado.cidade, 
          localSorteado.regiao, 
          localSorteado.estado, 
          "Fatal Model", 
          "Privacy", 
          "Photo Acompanhante", 
          "Câmera Privê"
        ];

        // Insere a postagem diretamente via API pública
        const post = await blogger.posts.insert({
          blogId: process.env.BLOG_ID,
          isDraft: false, // Publica imediatamente sem passar por rascunho
          requestBody: {
            title: titulo,
            content: htmlContent,
            labels: tagsBlogger
          }
        });

        // Salva o registro estruturado no Firestore para controle de duplicidade
        await docRef.set({
          username: model.username,
          cidade: localSorteado.cidade,
          estado: localSorteado.estado,
          postId: post.data.id,
          dataPublicacao: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[SUCESSO] Post injetado com ID: ${post.data.id}`);
      } else {
         // Se a modelo já existe, atualiza apenas o timestamp para controle interno
         await docRef.update({
           dataPublicacao: admin.firestore.FieldValue.serverTimestamp()
         });
         console.log(`Modelo ${model.username} já ativa no catálogo. Pulando...`);
      }
    }
    console.log("Rotina de alimentação do robô executada com sucesso!");
  } catch (error) {
    console.error("Erro crítico na execução do bot GitHub:", error.message);
  }
}

runBot();
