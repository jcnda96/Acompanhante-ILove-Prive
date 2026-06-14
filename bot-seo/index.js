const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Configuração da API do Blogger
const oauth2Client = new google.auth.OAuth2(
  process.env.BLOGGER_CLIENT_ID,
  process.env.BLOGGER_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.BLOGGER_REFRESH_TOKEN });
const blogger = google.blogger({ version: 'v3', auth: oauth2Client });
const BLOG_ID = process.env.BLOG_ID;

// Caminho do arquivo de palavras-chave
const keywordsFilePath = path.join(__dirname, 'keywords.json');

async function run() {
  try {
    // 1. Ler as palavras-chave
    if (!fs.existsSync(keywordsFilePath)) {
      console.log("Arquivo keywords.json não encontrado. Fim do processo.");
      return;
    }

    let keywords = JSON.parse(fs.readFileSync(keywordsFilePath, 'utf8'));
    if (keywords.length === 0) {
      console.log("Todas as palavras-chave já foram processadas!");
      return;
    }

    // 2. Pegar as 3 primeiras (maior volume)
    const numPosts = Math.min(3, keywords.length);
    const keywordsToPost = keywords.slice(0, numPosts);
    
    // Remover do array original e salvar
    keywords = keywords.slice(numPosts);
    fs.writeFileSync(keywordsFilePath, JSON.stringify(keywords, null, 2), 'utf8');

    console.log(`Iniciando postagem de ${numPosts} palavras-chave...`);

    // 3. Postar cada uma no Blogger
    for (const item of keywordsToPost) {
      const keyword = item.keyword;
      // Capitalizar a primeira letra
      const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      
      const title = `Encontre ${capitalizedKeyword} - As Melhores do Brasil`;
      
      const content = `
        <div class="post-city">Acesso VIP</div>

        <div class="image-wrapper" style="margin-bottom: 25px;">
          <a href="https://iloveprive.com/" target="_blank">
            <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjOVwMNEl9krGtRVS-JE0CurQCYKXJip-8zzcNjpwPdg4mThE5f40G-yy72CBX9DboZs9FRsMop4Q5gmeXFQx8NU7EbhaGWy9swOd9rbzFpDGgimbhcWyFN019TZCrndipL51iUYkQb8VrdP9NEo1ZWWsPKUd_nb2qIaEg6FR2AXMoThDXvuDeJc7UpFOQ/s225/logo-iloveprive.png" alt="${keyword}" class="avatar-img" style="border-radius: 12px !important; width: 100%; max-width: 300px; height: auto; aspect-ratio: auto;" />
          </a>
        </div>

        <div class="age-warning-banner" style="background: rgba(16, 185, 129, 0.1); color: #10b981; border-color: rgba(16, 185, 129, 0.3);">
          ✅ Acesso Liberado e Seguro
        </div>

        <div class="seo-desc" style="font-size: 15px; margin-top: 20px;">
          Buscando por <strong>${keyword}</strong>? Você acaba de encontrar o lugar certo! No <strong>I'Love Prive</strong> nós temos o maior catálogo de modelos e acompanhantes reais do Brasil. <br><br>
          Se o seu interesse é em <strong>${keyword}</strong>, saiba que nossa plataforma oferece chamadas de câmera privê ao vivo, estilo Fatal Model e Privacy, com total segurança e anonimato. 
          Não perca tempo, clique no botão abaixo para acessar agora!
        </div>

        <a href="https://iloveprive.com/" class="btn-call" target="_blank" style="margin-top: 20px; font-size: 18px;">Acessar I'Love Prive Agora 🔥</a>
      `;

      try {
        await blogger.posts.insert({
          blogId: BLOG_ID,
          requestBody: {
            title: title,
            content: content,
            labels: ['SEO_PAGE'] // TAG SECRETA PARA NÃO APARECER NA HOME
          }
        });
        console.log(`✅ Postado: ${keyword}`);
      } catch (err) {
        console.error(`❌ Erro ao postar ${keyword}:`, err.message);
      }
      
      // Pequeno delay de segurança entre as postagens (2 segundos)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`Rodada concluída. Restam ${keywords.length} palavras no arquivo json.`);

  } catch (error) {
    console.error("Erro geral no script de SEO:", error);
    process.exit(1);
  }
}

run();
