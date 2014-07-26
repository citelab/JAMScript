import re

mainpat = re.compile('(.*)\((.*)\)(.*)')
pointerpat = re.compile('(.*)\*(.*)')
parampat = re.compile('[^,]+')
a = "jamdef int* test(int a, int b, char *str, double q) {"
preamp = mainpat.search(a).group(1)
param = mainpat.search(a).group(2)
postamp = mainpat.search(a).group(3)

print "Preamp " 
print preamp

print "Param " 
print param

for q in parampat.finditer(param):
    p = q.group()
    if pointerpat.search(p) == None:
        print "Pointer Not found"
    else:
        print "Pointer Found"


print "Postamp "
print postamp

