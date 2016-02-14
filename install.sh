echo "Making jamlib..."
make
echo "Installing node dependencies..."
npm install
mkdir -p "/usr/local/share/jam"
cp "jamc" "/usr/local/bin"
cp -r "deps" "/usr/local/share/jam/"
cp "jamc.js" "/usr/local/share/jam/"
cp -r "lib/c" "/usr/local/share/jam/lib/"
cp -r "lib/jamlib" "/usr/local/share/jam/lib/"
cp -r "lib/jamscript" "/usr/local/share/jam/lib/"
cp "LICENSE" "/usr/local/share/jam/"
cp -r "node_modules" "/usr/local/share/jam/"
cp "utils.js" "/usr/local/share/jam/"