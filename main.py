import base64
import html
import os
import sys
import argparse
import re
import pdfkit
import time
from pylatexenc.latex2text import LatexNodes2Text


# Get current binaries.
def get_cur_dir():
    cur_dir = os.path.dirname(os.path.abspath(__file__))
    # Add wkhtmltopdf binaries.
    if sys.platform.startswith("linux"):
        path_wkhtmltopdf = os.path.join(cur_dir, "wkhtmltopdf")
        config = pdfkit.configuration(wkhtmltopdf=path_wkhtmltopdf)
        return config
    
    elif sys.platform.startswith("win32"):
        path_wkhtmltopdf = os.path.join(cur_dir, "wkhtmltopdf.exe")
        config = pdfkit.configuration(wkhtmltopdf=path_wkhtmltopdf)
        return config
        
    else:
        print("[Error] Your OS is not supported! Exit.")
        return


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
            time.sleep(0.5)    
    else:
        print("[INFO] File supported! Start decoding.")
        time.sleep(0.5)
    
    # Decode QaA then store it in a list.
    print("[INFO] Decoding questions and answers.")
    time.sleep(0.5)
    decodedQaAs = []
    for encodedQaA in encodedQaAs:
        decodedQaAs.append(html.unescape((base64.b64decode(encodedQaA)).decode("utf-8")))

    # Decode HTML and apply color format for correct answer.
    print("[INFO] Applying color format.")
    time.sleep(0.5)
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
    
    print("[INFO] Writing to temporary file.")
    time.sleep(0.5)
    os.chdir(folder)
    with open("decode.htm", "w", encoding="utf-8") as file2:
        for i in split:
            file2.write(f"Câu {questionNumber + 1}:\n")
            file2.write(i + "\n")
            questionNumber += 1
    
    # Decodes LaTeX encoding in a file.
    add_fraction_bar_for_fractions("decode.htm")


def add_fraction_bar_for_fractions(input_file):
    # Add fraction bar for fractions.
    fractions = []
    
    with open(input_file, "r", encoding="utf-8") as f:
        orig_file = f.read()
        fractions_sign = re.findall(r"(?<=\\dfrac).+?(?=\$)", orig_file)
        if not fractions_sign:
            parse_latex(input_file)
            return
        
        else: 
            fractions.append(re.sub(r"(?<=\})(?=\{)", r"/", orig_file))   
    
    with open(input_file, "w", encoding="utf-8") as f:
        for i in fractions:
            f.write(i)
    
    parse_latex(input_file)
    

def parse_latex(input_file):
    print("[INFO] Parsing LaTex (if available).")
    time.sleep(0.5)
    with open(input_file, "r", encoding="utf-8") as f:
        latex_code = f.read()
        html_code = LatexNodes2Text().latex_to_text(latex_code)

    with open(input_file, "w", encoding="utf-8") as f:
                f.write(html_code)
          
    # Convert the HTML file "input.htm" to the PDF file "output.pdf".
    convert_htm_to_pdf(input_file, "Decoded.pdf")


def convert_htm_to_pdf(htm_file, pdf_file):
    print("[INFO] Converting HTML file to PDF.")
    time.sleep(0.5)
    # Options for wkhtmltopdf.
    options = {
        "encoding": "UTF-8"
    }
    
    get_cur_dir()
    pdfkit.from_file(htm_file, pdf_file, options = options, configuration=get_cur_dir())
    print(f"[INFO] File decoded. Output file is in {os.path.abspath(os.curdir)}.")
    
    
if __name__ == "__main__":
    arg_parser = create_arg_parser()
    parsed_args = arg_parser.parse_args(sys.argv[1:])
    fn = parsed_args.inputDir
    if parsed_args.outputDir == None:
        folder = os.path.abspath(os.path.dirname(parsed_args.inputDir))
    else:
        folder = parsed_args.outputDir
    decode_file(fn, folder)

