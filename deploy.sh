npm install -g @angular/cli
yarn install
git submodule add -f https://$site_user:$site_pass@strayossite.scm.azurewebsites.net/strayossite.git build
rm -rf build/*
ng build
cp -r dist/* build/
git config --global user.email "sahil@strayos.com"
git config --global user.name "Sahil Kataria"
git add -A .
git push origin master
