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

// BANCO DE DADOS DE SEO LOCAL - TODOS OS ESTADOS BRASILEIROS
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

    console.log(`Encontradas ${models.length} modelos. Processando lote de 3 listagens...`);
    const lote = models.slice(0, 3);

    for (const model of lote) {
      const docRef = db.collection('modelos_ativas').doc(model.username);
      const doc = await docRef.get();

      if (!doc.exists) {
        // Modelo nova: Sorteia localidade
        const localSorteado = LOCALIDADES[Math.floor(Math.random() * LOCALIDADES.length)];
        
        // Estrutura de Títulos (SEO)
        const titulo = `Photo Acompanhante ${model.username} - Garota com Local em ${localSorteado.cidade} ${localSorteado.estado}`;
        
        // CORREÇÃO AUDITORIA: Adicionada a Descrição de Pesquisa dinamicamente
        const descPesquisa = `Acompanhante ${model.username} em ${localSorteado.cidade} ${localSorteado.estado}. Câmera privê estilo Fatal Model e Privacy. Clique para ver conteúdos +18 e encontros reais.`;
        
        const atributos = model.tags ? model.tags.slice(0, 5).join(', ') : 'Premium, Online';
        const avatar = model.avatarUrl || 'https://via.placeholder.com/300';
        
        // Link de Afiliado Seguro
        const linkAfiliado = `https://go.mavrtracktor.com/api/goToTheRoom?modelsList=${model.username}&userId=${process.env.STRIPCASH_USER_ID}&targetDomain=iloveprive.com`;

        // HTML Injetado (Desfoque, Aviso +18, Bolinhas e Links)
        const htmlContent = `
          <div class="post-city">${localSorteado.cidade} - ${localSorteado.estado}</div>
          
          <!-- IMAGEM DESFOCADA (BLUR) E CLICÁVEL -->
          <div class="image-wrapper" style="position: relative; display: inline-block; width: 100%; text-align: center; margin-bottom: 15px;">
            <a href="${linkAfiliado}" target="_blank" rel="nofollow" style="display: block; position: relative;">
              <img src="${avatar}" alt="Acompanhante ${model.username}" class="avatar-img" style="filter: blur(12px); -webkit-filter: blur(12px); transform: scale(1.05);" />
            </a>
          </div>

          <!-- AVISO DE IDADE OBRIGATÓRIO (SEGURANÇA DO GOOGLE) -->
          <div class="age-warning" style="background: rgba(225, 29, 72, 0.1); color: #e11d48; padding: 10px; text-align: center; font-size: 11px; font-weight: 800; border-radius: 8px; border: 1px solid rgba(225, 29, 72, 0.3); margin-bottom: 15px; text-transform: uppercase;">
            🔞 Conteúdo Sensível - Apenas Maiores de 18 Anos
          </div>

          <div class="status-online"><div class="status-dot"></div> TRANSMITINDO AO VIVO</div>
          
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
            Procurando por <strong>photo acompanhante</strong> ou perfil estilo <strong>fatal model</strong> em <strong>${localSorteado.cidade} (${localSorteado.estado})</strong>? Conecte-se agora com <strong>${model.username}</strong>. Atendimento exclusivo via <strong>câmera privê</strong> com total sigilo. Acesse conteúdos estilo <strong>onlyfans</strong> e <strong>privacy</strong> com segurança.
          </div>
          
          <a href="${linkAfiliado}" class="btn-call" target="_blank" rel="nofollow">
            Entrar no Privê Agora
          </a>

          <!-- BOLINHAS / LINKS PARA MODELOS IGUAIS DA MESMA REGIÃO -->
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

        console.log(`Criando listagem otimizada: ${model.username} em ${localSorteado.cidade}-${localSorteado.estado}`);
        
        // Remove duplicatas usando Set (caso a região e cidade tenham o mesmo nome)
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
            customMetaData: descPesquisa, // CORREÇÃO AUDITORIA: Injetado na Descrição
            location: { name: `${localSorteado.cidade}, ${localSorteado.estado}, Brasil` } // CORREÇÃO AUDITORIA: Injetado no mapa Localização
          }
        });

        await docRef.set({
          username: model.username,
          cidade: localSorteado.cidade,
          estado: localSorteado.estado,
          postId: post.data.id,
          dataPublicacao: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[SUCESSO] Post injetado com ID: ${post.data.id}`);
      } else {
         await docRef.update({
           dataPublicacao: admin.firestore.FieldValue.serverTimestamp()
         });
      }
    }
    console.log("Rotina executada com sucesso!");
  } catch (error) {
    console.error("Erro crítico na execução do bot:", error.message);
  }
}

runBot();
