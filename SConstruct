import subprocess
import re

node_v = subprocess.check_output(["node", "-v"])
node_loc = re.search('v[0-9]+.[0-9]+.[0-9]+', node_v)
if node_loc==None:
    print "No Nodejs found ... Please Install it"
    Exit(1);
else:
    node_v = node_v[1:len(node_v) -1];
    version = node_v.split('.', 2);
    if(int(version[0]) < 6):
        print "Please reinstall node. Current version is " + ".".join(version) + "\n This application requires 6.3.1"
        Exit(1);
    if(int(version[1]) < 3):
        print "Please reinstall node. Current version is " + ".".join(version) + "\n This application requires 6.3.1"
        Exit(1);
    if(int(version[2]) < 1):
        print "Please reinstall node. Current version is " + ".".join(version) + "\n This application requires 6.3.1"
        Exit(1);

npm_v = subprocess.check_output(["npm", "-v"])
npm_loc = re.search("[0-9]+.[0-9]+.[0-9]+", npm_v)
if npm_loc==None:
    print "No NPM found ... Please Install it"
    Exit(1);

subprocess.check_output(["npm", "install"])
#Now we test for C library dependencies

env = Environment()
conf = Configure(env)

req_c_lib = None;
if env['PLATFORM']=='posix':
    print 'Platform is posix'
    req_c_lib = ['m', 'bsd', 'pthread', 'cbor', 'nanomsg', 'task', 'event', 'hiredis']
elif env['PLATFORM']=='darwin':
    print 'Platform is darwin'
    req_c_lib = ['cbor', 'nanomsg', 'task', 'event', 'hiredis']
else:
    print 'Windows not supported ...'
#required_libraries = ['m']

for iterating_var in req_c_lib:
    if not conf.CheckLib(iterating_var):
        print iterating_var + " library is missing .. "
        Exit(1);

c_files = Glob('lib/jamlib/c_core/*.c');
c_files.append('lib/jamlib/c_core/duktape/duktape.c')

library = Library('jam', Glob('lib/jamlib/c_core/*.c'), LIBS=req_c_lib, LIBPATH = ['/usr/lib', '/usr/local/lib'])

env.InstallAs("/usr/local/bin/jamc", "jamc" );
env.InstallAs("/usr/local/include/jam.h", "./lib/jamlib/c_core/jam.h");
env.InstallAs("/usr/local/share/jam/jamc.js", "jamc.js");
env.InstallAs("/usr/local/share/jam/lib/jamlib", "lib/jamlib");
env.InstallAs("/usr/local/share/jam/lib/jserver", "lib/jserver");
env.InstallAs("/usr/local/share/jam/lib/ohm", "lib/ohm");
env.InstallAs("/usr/local/share/jam/LICENSE", "LICENSE");
env.InstallAs("/usr/local/share/jam/node_modules", "node_modules");
compiled_library = env.InstallAs("/usr/local/lib/libjam.a", "libjam.a");

Depends(compiled_library, library);
