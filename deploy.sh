npm install -g @angular/cli
yarn install
git submodule add -f https://$site_user:$site_pass@strayossite.scm.azurewebsites.net/strayossite.git dist
ng build
cd dist
git config --global user.email "sahil@strayos.com"
git config --global user.name "Sahil Kataria"
git add .
git push origin master
