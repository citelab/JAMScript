#!/bin/bash
for DOTFILE in $(find -name "*.dot"); do
    echo $DOTFILE
    OUTFILE=$(echo "$DOTFILE" | sed -e 's/dot$/pdf/')
    dot -Tpdf $DOTFILE -o $OUTFILE
done
