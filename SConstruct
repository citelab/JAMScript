import subprocess
import re


########################
# Check program versions
########################

node_v = subprocess.check_output("node -v", shell=True)
node_loc = re.search('v[0-9]+.[0-9]+.[0-9]+', node_v)
if node_loc==None:
    print "No Nodejs found ... Please Install it"
    Exit(1);
else:
    node_v = node_v[1:len(node_v) -1];
    version = node_v.split('.', 2);
    if(int(version[0]) < 7):
        print "Please reinstall node. Current version is " + node_v + "\n This application requires version 7.0.0 or higher"
        Exit(1);


npm_v = subprocess.check_output("npm -v", shell=True)
npm_loc = re.search("[0-9]+.[0-9]+.[0-9]+", npm_v)
if npm_loc==None:
    print "No NPM found ... Please Install it"
    Exit(1);

subprocess.check_call("npm install -g", shell=True)
#Now we test for C library dependencies

# env = Environment(CC = 'clang', CCFLAGS='-g -DDEBUG_LVL1', LIBPATH=['/usr/local/lib'])
env = Environment(CC = 'clang', CCFLAGS='-g', LIBPATH=['/usr/local/lib'])
env.Append(CPPPATH='/usr/local/include')
env.Append(FRAMEWORKS='CoreFoundation')

conf = Configure(env)

req_c_lib = None;
if env['PLATFORM']=='posix':
    print 'Platform is posix'
    req_c_lib = ['m', 'bsd', 'pthread', 'cbor', 'nanomsg', 'task', 'event', 'hiredis']
elif env['PLATFORM']=='darwin':
    print 'Platform is darwin'
    req_c_lib = ['task', 'hiredis']
else:
    print 'Windows not supported ...'
#required_libraries = ['m']
#req_c_lib = ['m']

#for iterating_var in req_c_lib:
#    if not conf.CheckLib(iterating_var):
#        print iterating_var + " library is missing .. "
#        Exit(1);

c_files = Glob('lib/jamlib/*.c');

libtask = env.Command("./deps/libtask/libtask.a", "", "cd deps/libtask && make")
library = env.Library('jam', Glob('lib/jamlib/*.c'), LIBS=req_c_lib, LIBPATH = ['/usr/lib', '/usr/local/lib', '/usr/local/share/paho/lib'])
c_core_files = Glob('./lib/jamlib/*.h');
c_core_files.append("./lib/jamlib/duktape");

compiled_library = env.Install("/usr/local/lib", "libjam.a");
env.Install("/usr/local/share/jam/lib/", c_core_files);
compiled_libtask = env.Install('/usr/local/share/jam/deps/libtask/', "./deps/libtask/libtask.a");
env.Install('/usr/local/share/jam/lib/jserver', Glob('./lib/jserver/*.js'));
env.Install('/usr/local/share/jam/deps/', "./deps/fake_libc_include/");

ib = env.Alias('install-bin', "/usr/local/bin");
il = env.Alias('install-share', "/usr/local/share/jam");
ii = env.Alias('install-include', "/usr/local/include/jam");
ill = env.Alias('install-lib', "/usr/local/lib");
a1 = env.Alias('a1', "/usr/local/share/jam/lib");
a2 = env.Alias('a5', '/usr/local/share/jam/deps/libtask');
a3 = env.Alias('a6', '/usr/local/share/jam/lib/jserver');
a4 = env.Alias('a5', '/usr/local/share/jam/deps/');

env.Alias('install', [ib, ii, il, il, il, ill, a1, a2, a3, a4])

Depends(compiled_library, library);
Depends(compiled_libtask, libtask);
