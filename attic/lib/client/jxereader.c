
#include <zip.h>



/**
 * Open the JAMScript executable file. If not found, print out an error message and quit.
 * If the file is found, validate the file to ensure it contains the appropriate file.
 *
 * Open the file, locate the manifest.tml (TOML file) and read it. A TOML data structure
 * for the manifest.tml is held in memory - pointed to by the jxe_file pointer.
 */

jxe_file *open_jam_executable(char *path)
{
    int eflag;
    jxe_file *j = calloc(1, sizeof());


    j.zipfile = zip_open(path, ZIP_RDONLY, &eflag);

    if (zf == NULL) {
        printf("[open_jam_exe]:: error opening zip file: code = %d\n", eflag);
        exit(1);
    }

	// TODO: Load the manifest.tml file into memory..

    // Check that the archive holds all the files listed in the manifest.tml.


}


/**
 * Load the C program. It has two main functions: user_main() and user_setup().
 * These two portions are located in two .o files. So we load them one after the other and
 * start their execution. We use the dynamic library loading facility to get them going.
 * On error, we return -1 and 0 on success.
 */
int load_jxe_cprog(jxe_file *j)
{


    // Return 0 on success
    return 0;
}


/**
 * Only C activities are loaded.
 * From the archive, load the activity with the given name. If the activity is not present
 * then return an error code (-1). On success return an error code (0). The activity is loaded
 * using the dynamic library loading facility.
 */

int load_jxe_activity(jxe_file *j, char *actname)
{


}


/**
 * Load activities that have certain attributes or tags from the JXE file.
 * On success returns the number of activities loaded and -1 on error. Return value of 0
 * indicates no activities matching the tags were found.
 * Additionally, same comment as the above one apply here too.
 */
int load_jxe_activities(jxe_file *j, char *tags[])
{

}




/**
 * Load the JS portion. We directly load the file into the remote node's disk. This is
 * accomplished through a FTP service built into the JS node. We ask it to save the transported
 * file into the disk storage at the remote location. We can later ask the servlet to load it
 * as part of it.
 *
 * One argument is the JS node. We assume the JS node could be in a different machine. So file
 * should be sent through the JS node.
 */
int jxe_load_js_file(jxe_file *j, jam_machine *m)
{


}


/**
 * Run the main C program. 







/**
 * ROUGH NOTES
 * L
