import base64
import html
import os
import sys
import argparse
import re


# Handle path & folder.
def create_arg_parser():
    # Creates and returns the ArgumentParser object.
    parser = argparse.ArgumentParser()
    parser.add_argument("inputDir", help="Path to the input directory.")
    parser.add_argument(
        "outputDir",
        nargs="?",
        help="Path to the output directory.",
    )
    args = parser.parse_args()
    return parser


def decode_file(fn, folder):
    # Decodes the given file and saves it as a HTML file in the given folder.

    # Check if file exists.
    if not os.path.exists(fn):
        print("[Error] File not found! Exit.")
        return

    # Open File and Read It.
    with open(fn, "r") as file:
        encodedQaAs = re.findall(r"(?<=content\":\s\").+?(?=\")", file.read())

    # Check if file is valid.
    if not encodedQaAs:
        with open(fn, "r") as file:
            encodedQaAs = re.findall(r"(?<=content\":\").+?(?=\")", file.read())
        
        if not encodedQaAs:
            print("[Error] File is not supported! Exit.")
            return
        
        else:
            print("[INFO] File supported! Start decoding.")    
    else:
        print("[INFO] File supported! Start decoding.")
    
    # Decode QaA then store it in a list.
    print("[INFO] Decoding questions and answers.")
    decodedQaAs = []
    for encodedQaA in encodedQaAs:
        decodedQaAs.append(html.unescape((base64.b64decode(encodedQaA)).decode("utf-8")))

    # Decode HTML and apply color format for correct answer.
    print("[INFO] Applying color format.")
    split = []
    questionNumber = 0

    for decodedQaA in decodedQaAs:
        if re.search(r"<li class=\"correctAnswer\">", decodedQaA) is None:
            split.append(re.sub(r"<li class = 'correctAnswer'>", "<li style=\"color:red\">", decodedQaA))
        else:
            split.append(re.sub(r"<li class=\"correctAnswer\">", "<li style=\"color:red\">", decodedQaA))

    # Save.
    try:
        os.mkdir(folder)
    except FileExistsError:
        pass
    os.chdir(folder)
    with open("decode.htm", "w", encoding="utf-8") as file2:
        for i in split:
            file2.write(f"Câu {questionNumber + 1}:\n")
            file2.write(i + "\n")
            questionNumber += 1
    print(f"[INFO] Done! File is stored in {os.path.join(folder, 'decode.htm')}")
    
       
if __name__ == "__main__":
    arg_parser = create_arg_parser()
    parsed_args = arg_parser.parse_args(sys.argv[1:])
    fn = parsed_args.inputDir
    if parsed_args.outputDir == None:
        folder = os.path.abspath(os.path.dirname(parsed_args.inputDir))
    else:
        folder = parsed_args.outputDir
    decode_file(fn, folder)
