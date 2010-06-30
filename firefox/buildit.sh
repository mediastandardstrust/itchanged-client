EXTENSION=itchanged
#cd idls
#./xpidl -m typelib INews.idl
#cp INews.xpt ../components
#cd ..
rm  *.xpi
rm -rf $EXTENSION
mkdir $EXTENSION
cd $EXTENSION
rsync -r --exclude=.svn --exclude-from=../excludefile.txt ../* .
rm chrome.manifest
mv chrome.manifest.jar chrome.manifest
cd chrome
zip -r $EXTENSION.jar content locale skin
rm -rf content
rm -rf locale
rm -rf skin
cd ../..
cd $EXTENSION
VERSION=`grep "em:version" install.rdf | sed -e 's/[ \t]*em:version=//;s/"//g'`
TOOLBAR=$EXTENSION-$VERSION
zip -r -D ../$TOOLBAR.xpi *
cd ..
rm -rf $EXTENSION
