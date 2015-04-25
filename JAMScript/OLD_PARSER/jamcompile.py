#!/usr/bin/python
#
# jamcompile.py - main script for the JAMScript translator.
#
# This script translates JAMScript source to .c, .h, .js, and .xml files
# While the .c and .h files are compiles to create the executable for 
# the 'thing', the other files are packaged and sent to the web/cloud.
# A table of contents .toc is also created by the translator so the 
# loader can find the functions in the package.
#
#
import sys
import os

from jamparser import jamparser

#
# validate the input parameters...
# We need input files and they need to have .ja or .c extensions
# No other extensions are valid for the input files.
#
def validate_inputs():
	print "JAMScript Translator Version 0.2"
	if len(sys.argv) < 2:
		print "No input files ... "
		exit(0)
	else:
		for arg in sys.argv:
			if arg.endswith(".py"):
				continue
			if arg.endswith(".c"):
				continue
			if not arg.endswith(".ja"):
				print "Error!! Files need .ja extension: " + arg
				exit(0)
	print "Translating..."

#
# C files (with .c extension) are skipped. 
# JAMScript files are converted to .c and .js
# For the new files we use the old filename as the base
#
def translate(jfile):
	# just return if the source is already in C
	if jfile.endswith(".c"):
		return
	# output current translation target
	print "[" + jfile + "]"

	# find filenames..
	fname, fext = os.path.splitext(jfile)
	cfile = fname + ".c"
	jsfile = fname + ".js"

	# Open files..
	try:
		jfp = open(jfile, "r")
	except IOError as e:
		print "File: " + jfile + "not found.. translation stopped."
		exit(0)

	try:
		cfp = open(cfile, "w+")
		jsfp = open(jsfile, "w+")
	except IOError as e:
		print "Translation terminated. " + e
		exit(0)

	# call the parser... this is just another function
	jamparser(jfp, cfp, jsfp)

# TODO: We need to write out the table of contents as well.
# TODO: Check if multiple JavaScript functions can be loaded from a single file


#
# Main function .. check the command line for validatity and then calls the translator
# TODO: Add the build logic too..
# 
# 
if __name__ == "__main__":
	validate_inputs()
	for arg in sys.argv:
		if not arg == "jamcompile.py":
			translate(arg)
# 
# TODO: After the files are created, start the build process. Should we use scons?
# 
