# Jean Ropke Maps

Diretorio de mapas em https://jeanropke.github.io/.
O index.html anterior, que redirecionava para RDR2CollectorsMap, foi substituido pelo hub.

## Desenvolvimento

Requer Node.js 22.12 ou superior.

    npm ci
    npm run dev

## Build

    npm run build
    npm run preview

O site compilado fica em dist/. Os arquivos em public/ sao copiados sem alteracoes
para o build, incluindo ads.txt, verificacao do Google, robots.txt e sitemap.xml.
As copias originais desses arquivos na raiz foram preservadas; para alterar o
conteudo publicado pelo build, edite public/.

## Publicacao

Em Settings > Pages, selecione GitHub Actions como Source.
O workflow .github/workflows/pages.yml publica dist/ a cada push em main,
ou pode ser iniciado manualmente na aba Actions.

Este checkout nao inclui credenciais nem os scripts de publicacao da HostGator.