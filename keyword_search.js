const fs = require('fs');
//array of standard stopwords
var stopwords=['i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', "you're", "you've", "you'll", "you'd", 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', "she's", 'her', 'hers', 'herself', 'it', "it's", 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', "that'll", 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', "don't", 'should', "should've", 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', "aren't", 'couldn', "couldn't", 'didn', "didn't", 'doesn', "doesn't", 'hadn', "hadn't", 'hasn', "hasn't", 'haven', "haven't", 'isn', "isn't", 'ma', 'mightn', "mightn't", 'mustn', "mustn't", 'needn', "needn't", 'shan', "shan't", 'shouldn', "shouldn't", 'wasn', "wasn't", 'weren', "weren't", 'won', "won't", 'wouldn', "wouldn't"];
//adds extra stopwords to the array
stopwords.push("including");
stopwords.push("fig");
stopwords.push("doi");
stopwords.push("ann");
stopwords.push("anns");

//Initializes the word tokenizer from the 'natural' node
var natural = require('natural');
var tokenizer = new natural.WordTokenizer();
//Initialzes the Porter Stemmed from 'natural'
natural.PorterStemmer.attach();
var NGrams = natural.NGrams;
var filepath='arxiv_abstracts/arxivData.json';

//imports a json file
function importJSON(filepath){
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

//sorts a map of words by word count
function keySort(wordMap){
    return Object.keys(wordMap).sort(function(a,b) { return wordMap[b] - wordMap[a] }).map(function(k) { return {key: k, value: wordMap[k]} });
}

//Returns a processed entry containing only authors, title, and the abstract
function extractText(entry){
    return {author: entry.author, title: entry.title.replace(/\n/g, " "), summary: entry.summary.replace(/\n/g, " ").toLowerCase()};
}

//Returns the ngram counts of an input entry 
function computeEntry(entry){
    entry=extractText(entry);
    return summary2WC(entry.summary);
}

//Input: processed text from research abstract
//Returns valid ngram for n=1:4
function summary2WC(summary){
    var biCounts={};
    var triCounts={};
    var quadCounts={};
    var wordCounts=findWordCounts(summary);
    var biCounts=mergeStems(findBiCounts(summary));
    var triCounts=findTriCounts(summary, biCounts);
    var quadCounts=findQuadCounts(summary, triCounts);
    return [wordCounts, biCounts, triCounts, quadCounts];
}

//Removes stopwords, numerical values, and single-character words from a word array
function processWordTokens(wordArray){
    var cleanArray=[];
    wordArray.forEach(function (key) {
      key=key.toString().toLowerCase();
      if (!(stopwords.includes(key)) && isNaN(key) && key.length>1){
          cleanArray.push(key);
      }
    });
    return cleanArray;
}

//Returns a map of word counts
function findWordCounts(summary){
    var wordCounts={};
    var wordArray=tokenizer.tokenize(summary);
    wordArray=processWordTokens(wordArray);
    wordArray.forEach(function(key){
        if (wordCounts.hasOwnProperty(key)) {
            wordCounts[key]++;
        }
        else {
            wordCounts[key] = 1;
        }
      })
    return wordCounts;
}

//Returns a map of bigram counts
function findBiCounts(summary){
    var biCounts={};
    var bigrams=NGrams.bigrams(summary);
    bigrams.forEach(function(pair){
        if(!(stopwords.includes(pair[0]) || stopwords.includes(pair[1])) && (isNaN(pair[0])&&isNaN(pair[1]))){
            key=pair[0].concat(" ", pair[1]);
            if (biCounts.hasOwnProperty(key)){
                biCounts[key]++;
            }
            else{
                biCounts[key]=1;
            }
        }
    })
    return biCounts;
}

//Returns a map of trigram counts
function findTriCounts(summary, biCounts){
    var triCounts={};
    var word1=[];
    var word2=[];
    biCounts=keySort(biCounts);
    //Hard coded limit on number of bigrams searched to 50
    numsearch=Math.min(50, biCounts.length);
    for(i=0; i<numsearch; i++){
        split=biCounts[i].key.split(" ");
        word1.push(split[0]);
        word2.push(split[1]);
    }
    for(i=0; i<numsearch; i++){
        for(j=0; j<numsearch; j++){
            if(!(i==j) && word2[i]==word1[j]){
                key=word1[i].concat(" ", word2[i], " ", word2[j]);
                value=Math.min(biCounts[i].value, biCounts[j].value);
                if (triCounts.hasOwnProperty(key)){
                    triCounts[key]+=value;
                }
                else{
                    triCounts[key]=value;
                }
            }
        }
    }
    return triCounts;
}

//Input is trigram counts and the original processed text
//Returns a map of quadgram counts
//Eliminates quadgrams with repeated words
function findQuadCounts(summary, triCounts){
    var quadCounts={};
    triCounts=keySort(triCounts);
    var split=[];
    for(i=0; i<triCounts.length; i++){
        split.push(triCounts[i].key.split(' '));
    }
    for(i=0; i<triCounts.length; i++){
        var frag1=split[i][1].concat(" ", split[i][2]);
        for(j=0; j<triCounts.length; j++){
            var frag2=split[j][0].concat(" ", split[j][1]);
            if(!(i==j) && frag2[i]==frag1[j]){
                key=split[i][0].concat(" ", frag1, " ", split[j][2]);
                value=Math.min(triCounts[i].value, triCounts[j].value);
                if(!(hasRepeatWord(key))){
                    if (quadCounts.hasOwnProperty(key)){
                        quadCounts[key]+=value;
                    }
                    else{
                        quadCounts[key]=value;
                    }
                }
            }
        }
    }
    return quadCounts;
}

//Checks if a word is repeated
function hasRepeatWord(key){
    var split=key.tokenizeAndStem();
    if(split.length < 2) return false;
    for(var i=0; i<split.length-1; i++){
        for(var j=i+1; j<split.length; j++){
            if(split[i]==split[j]){
                return true;
            }
        }
    }
    return false;
}

//Merges two word count maps together
function mergeCounts(count1, count2){
    for(var key in count2){
        if(count1.hasOwnProperty(key)){
            count1[key]+=count2[key];
        }
        else{
            count1[key]=count2[key];
        }
    }
    return count1;
}

//input is an ngram map of ngram:count
//Combines counts of ngrams that have identical stems
    //i.e. "neural network" and "neural networks" would be considered identical bigrams
//Outputs a map of ngram:count such that
    //1) each stemmed representative is represented once
    //3) the count is the sum of all ngrams that have the same stems
    //2) the highest frequency unstemmed ngram for each stemmed representative is the label for ngram
function mergeStems(rawMap){
    var buckets={};
    var stem;
    var maxKey;
    for(var key in rawMap){
        stem=key.tokenizeAndStem();
        stem=stem.join(' ');
        if(buckets.hasOwnProperty(stem)){
            buckets[stem][key]=rawMap[key];
            buckets[stem]['_total_']+=rawMap[key];
        }
        else{
            buckets[stem]={};
            buckets[stem][key]=rawMap[key];
            buckets[stem]['_total_']=rawMap[key];
        }
    }
    for(var cont in buckets){
        var value=buckets[cont]['_total_'];
        buckets[cont]['_total_']=0;
        buckets[cont]=keySort(buckets[cont]);
        maxKey=buckets[cont].shift();
        maxKey.value=value;
        buckets[cont]=maxKey;
        
    }
    var out={};
    for(var cont in buckets){
        out[buckets[cont].key]=buckets[cont].value;
    }
    return out;
}

//Prints the map
function peekMap(map, n){
    var ordered=keySort(map);
    n=Math.min(ordered.length, n);
    for(i=0; i<n; i++){
        console.log(ordered.shift());
    }
}

//Returns true if all words in the array are found in the abstract
function matchTerms(wordArray, summary){
    summary=summary.replace(/\s{2,}|[.,\/#!$%\^&\*;:{}=\-_`~()]/g," ");
    wt=tokenizer.tokenize(summary);
    for(var i=0; i<wordArray.length; i++){
        if(summary.search(wordArray[i])==-1){
            return 0;
        }
    }
    return 1;
}

//Finds the word, bigram, trigram, and quadgram counts in each paper
function totalCounts(journal){
    var wordTotal={};
    var biTotal={};
    var triTotal={};
    var quadTotal={};
    journal.forEach(function(entry){
        [wordCounts, biCounts, triCounts, quadCounts]=computeEntry(entry);
        wordTotal=mergeCounts(wordTotal, wordCounts);
        biTotal=mergeCounts(biTotal, biCounts);
        triTotal=mergeCounts(triTotal, triCounts);
        quadTotal=mergeCounts(quadTotal, quadCounts);
    })
    return [wordTotal, biTotal, triTotal, quadTotal];
}

//Constructs a query on the database
//Returns an array of processed text entries with identical indeces as the input
function constructQuery(rawJournal, include, exclude){
    var journal=[];
    if(exclude.length > 0){
        for(var i=0; i<exclude.length; i++){
            stopwords.push(exclude[i]);
        }
    }
    for(var i=0; i<raw.length; i++){
        cleanraw=extractText(rawJournal[i]);
        if (matchTerms(include, cleanraw.summary)>0){
            // console.log(i)
            journal.push(cleanraw);
        }
    }
    return journal;
}

//Function that prints NGram list
//This is hardcoded
function printNGrams(num,wordCounts, biCounts, triCounts, quadCounts){
    console.log("----------------------------------");
    console.log("Top " + num + " Grams");
    peekMap(wordCounts, num);
    console.log("----------------------------------");
    console.log("Top " + num + " BiGrams");
    peekMap(biCounts, num);
    console.log("----------------------------------");
    console.log("Top " + num + " TriGrams");
    peekMap(triCounts, num);
    console.log("----------------------------------");
    console.log("Top " + num + " QuadGrams");
    peekMap(quadCounts, num);    
}

//Returns the authors of a given publication as an array of strings
function getAuthor(entry){
    return entry.author.match(/\'[^':\\]* [^':\\]*\'/ig);
}

//Returns an array of strings of author names
function getAllAuthors(journal){
    var authorArray=[];
    var authors;
    for(i=0; i<journal.length; i++){
        authors=getAuthor(journal[i]);
        authors.forEach(function(name){
            if(!(authorArray.includes(name))){
                authorArray.push(name);
            }
        })
    }
    return authorArray;
}

//Searches through the database for publications by a given author
//Input is the raw json file
function getAuthorPublications(journal, name){
    var authors;
    var publications=[];
    for(var i=0; i<journal.length; i++){
        authors=journal[i].author;
        if(authors.includes(name)){
            publications.push(journal[i]);
        }
    }
    [wordCounts, biCounts, triCounts, quadCounts]=totalCounts(publications);
    return [wordCounts, biCounts, triCounts, quadCounts];
}

var include=[' clustering ', ' unsupervised ']; //Array of terms that all returned abstracts must contain
var exclude=[]; //Array of terms that all returned abstracts must NOT contain
var raw=importJSON(filepath);//Imports the arxiv abstracts

/*Constructs an array of entries that include and don't include the terms specified*/
var journal=constructQuery(raw, include, exclude);
//console.log(journal[0]);
console.log(journal.length + " abstracts found with the word(s) " + include.toString());

/*Returns a list of all authors in the constructed journal */
var authorList=getAllAuthors(journal);
authorList.forEach(function(name){
   console.log(name);
});

/*Prints the ngram counts of the given authors journal publications*/
[wordCounts, biCounts, triCounts, quadCounts]=getAuthorPublications(journal, authorList[3]);
[wordCounts, biCounts, triCounts, quadCounts]=totalCounts(journal);
wordCounts=mergeStems(biCounts);
printNGrams(50, wordCounts, mergeStems(biCounts), mergeStems(triCounts), mergeStems(quadCounts));

