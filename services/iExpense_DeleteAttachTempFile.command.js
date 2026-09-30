var filePath = ServiceManager.getInput("AttachFilePath");

try {
    if (filePath.length > 0) {
        Files.deleteFile(filePath);
    }
} catch (e) {
    console.log("###Failed to delete file: " + filePath)
}

return {
};