import base64
import html
import os
import sys
import argparse
import re
from docx import Document
from htmldocx import HtmlToDocx


# Handle path & folder
def create_arg_parser():
    # Creates and returns the ArgumentParser object

    parser = argparse.ArgumentParser()
    parser.add_argument("inputDir", help="Path to the input directory.")
    parser.add_argument("outputDir", help="Path to the input directory.")
    return parser


arg_parser = create_arg_parser()
parsed_args = arg_parser.parse_args(sys.argv[1:])
fn = parsed_args.inputDir
folder = parsed_args.outputDir

# Handle data
decodedQaAs = []
new_parser = HtmlToDocx()
document = Document()
split = []
questionNumber = 0

# Find the file and try to decode it if exists
if os.path.exists(fn):
    print("File found, try to decode it!")
    # Open File and Read It
    with open(fn, "r") as file:
        encodedQaAs = (re.findall(r"(?<=content\":\").+?(?=\")", file.read()))
        # Check if file is valid
        if not encodedQaAs:
            print("File is not supported! Exit.")
        else:
            # Decode QaA then store it in a list
            for encodedQaA in encodedQaAs:
                decodedQaAs.append(html.unescape((base64.b64decode(encodedQaA)).decode("utf-8")))
            print("File is supported! Decoding...")

            # Decode HTML to Docx and apply color format
            for decodedQaA in decodedQaAs:
                split.append(re.sub(r"<li class=\"correctAnswer\">", "<li style=\"color:red\">", decodedQaA))
            for i in split:
                p = document.add_paragraph(f"Câu {questionNumber+1}:")
                new_parser.add_html_to_document(i, document)
                questionNumber += 1
            questionNumber = 0

            # Save
            try:
                os.mkdir(folder)
                with open("decode.txt", "w", encoding="utf-8") as file2:
                    for i in split:
                        file2.write(f"Câu {questionNumber + 1}:\n")
                        file2.write(i + "\n")
                        questionNumber += 1
            except FileExistsError:
                os.chdir(folder)
                document.save("Decoded.docx")
                with open("decode.txt", "w") as file2:
                    for i in split:
                        file2.write(f"Câu {questionNumber+1}:\n")
                        file2.write(i + "\n")
                        questionNumber += 1
                print(f"File decoded. Output file is in {os.path.abspath(os.curdir)}")
            else:
                os.chdir(folder)
                document.save("Decoded.docx")
                with open("decode.txt", "w") as file2:
                    for i in split:
                        file2.write(f"Câu {questionNumber + 1}:\n")
                        file2.write(i + "\n")
                        questionNumber += 1
                print(f"File decoded. Output file is in {os.path.abspath(os.curdir)}")
else:
    print("File not found! Exit.")
