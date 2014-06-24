#!/usr/bin/python
#
# Jade.py - main script for the JADE translator..
#
#
import sys
import os

from japarser import japarser

#
# validate the input parameters...
# We need input files and they need to have .ja or .c extensions
# No other extensions are valid for the input files.
#
def validate_inputs():
	print "Jade Translator Version 0.1\n..........\n"
	if len(sys.argv) < 2:
		print "No input files.."
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

#
# C files (with .c extension) are skipped. 
# Jade files are converted to .c and .js
# For the new files we use the old filename as the base
#
def translate(jfile):
	# just return if the source is already in C
	if jfile.endswith(".c"):
		return

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
	japarser(jfp, cfp, jsfp)


#
# Main function .. check the command line for validatity and then calls the translator
# TODO: Add the build logic too..
#
#
if __name__ == "__main__":
	validate_inputs()
	for arg in sys.argv:
		if not arg == "jade.py":
			translate(arg)

 
