echo "Making C dependencies..."
# make
echo "Installing nodejs dependencies..."
# npm install

cp "jamc" "/usr/local/bin"
# cp "lib/jamrun/jamrun" "/usr/local/bin"

mkdir -p "/usr/local/share/jam"
cp -r "deps" "/usr/local/share/jam/"
cp "jamc.js" "/usr/local/share/jam/"
cp -r "lib/c" "/usr/local/share/jam/lib/"
cp -r "lib/jamlib" "/usr/local/share/jam/lib/"
cp -r "lib/jamscript" "/usr/local/share/jam/lib/"
cp -r "lib/jserver" "/usr/local/share/jam/lib/"
cp "LICENSE" "/usr/local/share/jam/"
cp -r "node_modules" "/usr/local/share/jam/"
cp "utils.js" "/usr/local/share/jam/"